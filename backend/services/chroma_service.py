"""
ChromaDB service.

SQLite is the source of truth. ChromaDB is a derived semantic index.
- upsert_work_items: called after confirm; indexes work items for vector search
- search_work_items: called by the chat agent's vector_search tool
- delete_work_log: called on soft-delete; removes associated vectors
- reindex_from_sqlite: rebuilds the entire ChromaDB index from SQLite (--reindex flag)
"""

import logging
from datetime import date
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "work_items"


def _get_client() -> chromadb.PersistentClient:
    return chromadb.PersistentClient(
        path=settings.CHROMA_PATH,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def _get_collection(client: chromadb.PersistentClient):
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def _build_document(item) -> str:
    """Combine task fields into a single searchable document string."""
    parts = [item.task_description]
    if item.project_name:
        parts.append(f"project: {item.project_name}")
    if item.ticket_id:
        parts.append(f"ticket: {item.ticket_id}")
    if item.blockers:
        parts.append(f"blockers: {item.blockers}")
    if item.next_steps:
        parts.append(f"next steps: {item.next_steps}")
    if item.tags:
        parts.append(f"tags: {', '.join(item.tags)}")
    return " | ".join(parts)


def _build_metadata(item, user_id: str) -> dict[str, Any]:
    """Build ChromaDB metadata dict — all values must be str/int/float/bool."""
    return {
        "user_id": user_id,
        "employee_id": item.employee_id,
        "work_log_id": item.work_log_id,
        "work_date": item.work_date.isoformat() if isinstance(item.work_date, date) else str(item.work_date),
        "work_category": item.work_category,
        "status": item.status or "",
        "priority": item.priority or "",
        "project_name": item.project_name or "",
        "ticket_id": item.ticket_id or "",
        "tags": ",".join(item.tags) if item.tags else "",
        "needs_review": item.needs_review,
        "hours_spent": item.hours_spent if item.hours_spent is not None else -1.0,
    }


def upsert_work_items(work_items: list, user_id: str) -> None:
    """
    Upsert a list of WorkItem ORM objects into ChromaDB.
    Uses work_item.id as the ChromaDB document ID.
    """
    if not work_items:
        return

    client = _get_client()
    collection = _get_collection(client)

    ids = [item.id for item in work_items]
    documents = [_build_document(item) for item in work_items]
    metadatas = [_build_metadata(item, user_id) for item in work_items]

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    logger.info("ChromaDB upsert: %d work items for user %s", len(work_items), user_id)


def delete_work_log(work_log_id: str) -> None:
    """Remove all ChromaDB entries associated with a work_log_id."""
    client = _get_client()
    collection = _get_collection(client)

    collection.delete(where={"work_log_id": work_log_id})
    logger.info("ChromaDB deleted entries for work_log_id=%s", work_log_id)


def search_work_items(
    query: str,
    user_id: str | None = None,
    n_results: int = 10,
    where: dict | None = None,
) -> list[dict]:
    """
    Semantic search over work items.

    Args:
        query:    Natural language query string
        user_id:  If set, restricts results to this user (employee access control)
        n_results: Max number of results
        where:    Additional ChromaDB metadata filters (merged with user_id filter)

    Returns:
        List of dicts with keys: id, document, metadata, distance
    """
    client = _get_client()
    collection = _get_collection(client)

    # Build where clause — user_id filter enforces per-employee access control
    filters: dict = {}
    if user_id:
        filters["user_id"] = {"$eq": user_id}
    if where:
        filters.update(where)

    query_kwargs: dict[str, Any] = {
        "query_texts": [query],
        "n_results": min(n_results, max(1, collection.count())),
        "include": ["documents", "metadatas", "distances"],
    }
    if filters:
        query_kwargs["where"] = filters

    results = collection.query(**query_kwargs)

    output = []
    if results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            output.append({
                "id": doc_id,
                "document": results["documents"][0][i],
                "metadata": results["metadatas"][0][i],
                "distance": results["distances"][0][i],
            })
    return output


def reindex_from_sqlite(db) -> int:
    """
    Rebuild the entire ChromaDB index from SQLite.
    Called by the --reindex CLI flag.

    Returns: number of items indexed.
    """
    from backend.models.work_item import WorkItem
    from backend.models.work_log import WorkLog

    client = _get_client()
    # Drop and recreate the collection
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    _get_collection(client)

    work_items = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(WorkLog.is_deleted == False)  # noqa: E712
        .all()
    )

    if not work_items:
        logger.info("reindex: no work items found in SQLite")
        return 0

    # Group by user_id via work_log join
    user_map: dict[str, str] = {}
    for item in work_items:
        if item.work_log_id not in user_map:
            log = db.query(WorkLog).filter(WorkLog.id == item.work_log_id).first()
            if log:
                user_map[item.work_log_id] = log.user_id

    # Upsert in batches of 100
    batch_size = 100
    total = 0
    for i in range(0, len(work_items), batch_size):
        batch = work_items[i:i + batch_size]
        if not batch:
            continue
        # All items in a batch share user_id via their work_log
        # Group by user for the upsert call
        by_user: dict[str, list] = {}
        for item in batch:
            uid = user_map.get(item.work_log_id, "unknown")
            by_user.setdefault(uid, []).append(item)
        for uid, items in by_user.items():
            upsert_work_items(items, uid)
            total += len(items)

    logger.info("reindex complete: %d work items indexed", total)
    return total
