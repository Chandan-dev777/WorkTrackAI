"""
Unit tests for chroma_service using an in-memory ChromaDB client.

We patch _get_client() to return an ephemeral in-memory client
so no files are written during tests.
"""

import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import chromadb
import pytest

from backend.services.chroma_service import (
    COLLECTION_NAME,
    delete_work_log,
    search_work_items,
    upsert_work_items,
)


def _make_work_item(
    work_log_id: str = None,
    employee_id: str = "EMP-001",
    work_date: date = None,
    task_description: str = "Fixed login bug",
    work_category: str = "ticket",
    status: str = "done",
    hours_spent: float = 2.0,
    tags: list = None,
    project_name: str = None,
    ticket_id: str = None,
    blockers: str = None,
    next_steps: str = None,
    needs_review: bool = False,
    priority: str = None,
):
    item = MagicMock()
    item.id = str(uuid.uuid4())
    item.work_log_id = work_log_id or str(uuid.uuid4())
    item.employee_id = employee_id
    item.work_date = work_date or date.today()
    item.task_description = task_description
    item.work_category = work_category
    item.status = status
    item.hours_spent = hours_spent
    item.tags = tags
    item.project_name = project_name
    item.ticket_id = ticket_id
    item.blockers = blockers
    item.next_steps = next_steps
    item.needs_review = needs_review
    item.priority = priority
    return item


@pytest.fixture
def in_memory_client():
    """
    Ephemeral ChromaDB client with the work_items collection pre-deleted
    to ensure a clean state for every test.
    """
    client = chromadb.EphemeralClient()
    # Ensure the collection starts empty for this test
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    return client


@pytest.fixture
def patch_chroma(in_memory_client):
    """Patch _get_client to return the ephemeral client for all tests."""
    with patch("backend.services.chroma_service._get_client", return_value=in_memory_client):
        yield in_memory_client


class TestUpsertWorkItems:
    def test_upsert_single_item(self, patch_chroma):
        item = _make_work_item()
        upsert_work_items([item], user_id="user-123")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 1

    def test_upsert_multiple_items(self, patch_chroma):
        items = [_make_work_item() for _ in range(3)]
        upsert_work_items(items, user_id="user-123")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 3

    def test_upsert_empty_list_is_noop(self, patch_chroma):
        upsert_work_items([], user_id="user-123")
        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 0

    def test_metadata_contains_user_id(self, patch_chroma):
        item = _make_work_item()
        upsert_work_items([item], user_id="user-abc")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        results = col.get(ids=[item.id], include=["metadatas"])
        assert results["metadatas"][0]["user_id"] == "user-abc"

    def test_metadata_contains_work_category(self, patch_chroma):
        item = _make_work_item(work_category="meeting")
        upsert_work_items([item], user_id="user-123")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        results = col.get(ids=[item.id], include=["metadatas"])
        assert results["metadatas"][0]["work_category"] == "meeting"

    def test_upsert_updates_existing(self, patch_chroma):
        item = _make_work_item(task_description="Original")
        upsert_work_items([item], user_id="user-123")

        item.task_description = "Updated"
        upsert_work_items([item], user_id="user-123")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 1  # still one, not two


class TestDeleteWorkLog:
    def test_delete_removes_items(self, patch_chroma):
        work_log_id = str(uuid.uuid4())
        items = [_make_work_item(work_log_id=work_log_id) for _ in range(2)]
        upsert_work_items(items, user_id="user-123")

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 2

        delete_work_log(work_log_id)
        assert col.count() == 0

    def test_delete_only_removes_target_log(self, patch_chroma):
        log_id_a = str(uuid.uuid4())
        log_id_b = str(uuid.uuid4())
        items_a = [_make_work_item(work_log_id=log_id_a)]
        items_b = [_make_work_item(work_log_id=log_id_b)]

        upsert_work_items(items_a, user_id="user-123")
        upsert_work_items(items_b, user_id="user-123")

        delete_work_log(log_id_a)

        col = patch_chroma.get_or_create_collection(COLLECTION_NAME)
        assert col.count() == 1  # log_b items remain


class TestSearchWorkItems:
    def test_search_returns_results(self, patch_chroma):
        item = _make_work_item(task_description="Fixed authentication bug in login flow")
        upsert_work_items([item], user_id="user-123")

        results = search_work_items("authentication bug", user_id="user-123")
        assert len(results) >= 1

    def test_search_filters_by_user_id(self, patch_chroma):
        item_a = _make_work_item(task_description="User A task", employee_id="EMP-001")
        item_b = _make_work_item(task_description="User B task", employee_id="EMP-002")
        upsert_work_items([item_a], user_id="user-aaa")
        upsert_work_items([item_b], user_id="user-bbb")

        results = search_work_items("task", user_id="user-aaa")
        assert all(r["metadata"]["user_id"] == "user-aaa" for r in results)

    def test_search_empty_collection_returns_empty(self, patch_chroma):
        results = search_work_items("anything", user_id="user-xyz")
        assert results == []

    def test_search_result_has_expected_keys(self, patch_chroma):
        item = _make_work_item(task_description="Reviewed pull request for data pipeline")
        upsert_work_items([item], user_id="user-123")

        results = search_work_items("code review", user_id="user-123")
        assert len(results) >= 1
        assert {"id", "document", "metadata", "distance"} == set(results[0].keys())
