"""
Worklogs router.

GET   /worklogs/my             — own work items with optional filters
GET   /worklogs/my/open        — own open tasks (in_progress / planned / blocked)
GET   /worklogs/team           — team work items (manager+)
PUT   /worklogs/{item_id}      — edit a single work item
POST  /worklogs/{item_id}/continue  — continue an open task (add hours / update status)
PATCH /worklogs/bulk-update    — batch status + hours update
"""

import logging
import uuid
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.routers.auth import get_current_user, require_role
from backend.schemas.work_item import BulkUpdateRequest, ContinueTaskRequest, WorkItemResponse, WorkItemUpdate
from backend.services import chroma_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/worklogs", tags=["worklogs"])


def _get_own_item_or_404(db: Session, item_id: str, user_id: str) -> WorkItem:
    item = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkItem.id == item_id,
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,  # noqa: E712
        )
        .first()
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work item not found")
    return item


@router.get("/my", response_model=list[WorkItemResponse])
def list_my_items(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    work_category: Optional[str] = Query(None),
    item_status: Optional[str] = Query(None, alias="status"),
    needs_review: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkItemResponse]:
    q = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == current_user.id,
            WorkLog.is_deleted == False,  # noqa: E712
        )
    )
    if start_date:
        q = q.filter(WorkItem.work_date >= start_date)
    if end_date:
        q = q.filter(WorkItem.work_date <= end_date)
    if work_category:
        q = q.filter(WorkItem.work_category == work_category)
    if item_status:
        q = q.filter(WorkItem.status == item_status)
    if needs_review is not None:
        q = q.filter(WorkItem.needs_review == needs_review)

    items = q.order_by(WorkItem.work_date.desc()).offset(skip).limit(limit).all()
    return [WorkItemResponse.model_validate(i) for i in items]


@router.get("/team", response_model=list[WorkItemResponse])
def list_team_items(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    employee_id: Optional[str] = Query(None),
    work_category: Optional[str] = Query(None),
    item_status: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[WorkItemResponse]:
    q = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(WorkLog.is_deleted == False)  # noqa: E712
    )
    if employee_id:
        q = q.filter(WorkItem.employee_id == employee_id)
    if start_date:
        q = q.filter(WorkItem.work_date >= start_date)
    if end_date:
        q = q.filter(WorkItem.work_date <= end_date)
    if work_category:
        q = q.filter(WorkItem.work_category == work_category)
    if item_status:
        q = q.filter(WorkItem.status == item_status)

    items = q.order_by(WorkItem.work_date.desc()).offset(skip).limit(limit).all()
    return [WorkItemResponse.model_validate(i) for i in items]


@router.put("/{item_id}", response_model=WorkItemResponse)
def update_work_item(
    item_id: str,
    payload: WorkItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkItemResponse:
    item = _get_own_item_or_404(db, item_id, current_user.id)

    changed = False
    for field, value in payload.model_dump(exclude_unset=True).items():
        if getattr(item, field) != value:
            setattr(item, field, value)
            changed = True

    if changed:
        item.is_user_corrected = True
        db.commit()
        db.refresh(item)
        try:
            chroma_service.upsert_work_items([item], current_user.id)
        except Exception as exc:
            logger.error("ChromaDB sync on edit failed: %s", exc)

    return WorkItemResponse.model_validate(item)


@router.get("/my/open", response_model=list[WorkItemResponse])
def list_open_tasks(
    days_back: int = Query(14, ge=1, le=90, description="How many days back to look for open tasks"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkItemResponse]:
    """Return open tasks (in_progress, planned, blocked) from the last N days."""
    since = date.today() - timedelta(days=days_back)
    items = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == current_user.id,
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.status.in_(["in_progress", "planned", "blocked"]),
            WorkItem.work_date >= since,
        )
        .order_by(WorkItem.work_date.desc())
        .all()
    )
    return [WorkItemResponse.model_validate(i) for i in items]


@router.post("/{item_id}/continue", response_model=WorkItemResponse)
def continue_task(
    item_id: str,
    payload: ContinueTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkItemResponse:
    """
    Continue an existing open task.

    Creates a new WorkItem linked to the original via logical_task_id so that
    multi-day work on the same task stays connected. The original task is
    updated to reflect the latest status if a status change is provided.
    """
    original = _get_own_item_or_404(db, item_id, current_user.id)

    # Resolve logical_task_id: inherit from original or mint a new one
    logical_id = original.logical_task_id or str(uuid.uuid4())
    if not original.logical_task_id:
        original.logical_task_id = logical_id

    today = payload.work_date or date.today()
    new_status = payload.status or original.status

    # Create a new linked WorkItem for today's continuation
    new_item = WorkItem(
        id=str(uuid.uuid4()),
        work_log_id=original.work_log_id,
        employee_id=current_user.employee_id,
        work_date=today,
        task_description=original.task_description,
        work_category=original.work_category,
        hours_spent=payload.hours_today,
        status=new_status,
        priority=original.priority,
        project_name=original.project_name,
        ticket_id=original.ticket_id,
        tags=original.tags,
        next_steps=payload.note,
        logical_task_id=logical_id,
        continuation_of=original.id,
        needs_review=False,
        clarification_needed=False,
        is_user_corrected=True,
    )
    db.add(new_item)

    # If status changed, also update the original so it's no longer "stale open"
    if payload.status and payload.status != original.status:
        original.status = payload.status
        original.is_user_corrected = True

    db.commit()
    db.refresh(new_item)

    try:
        chroma_service.upsert_work_items([new_item], current_user.id)
        if payload.status:
            chroma_service.upsert_work_items([original], current_user.id)
    except Exception as exc:
        logger.error("ChromaDB upsert on continue failed: %s", exc)

    return WorkItemResponse.model_validate(new_item)


@router.patch("/bulk-update", response_model=list[WorkItemResponse])
def bulk_update_items(
    payload: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkItemResponse]:
    """Batch-update status and/or add hours across multiple owned work items."""
    items = (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkItem.id.in_(payload.item_ids),
            WorkLog.user_id == current_user.id,
            WorkLog.is_deleted == False,  # noqa: E712
        )
        .all()
    )

    found_ids = {i.id for i in items}
    missing = set(payload.item_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work items not found or not owned by you: {sorted(missing)}",
        )

    for item in items:
        changed = False
        if payload.status and item.status != payload.status:
            item.status = payload.status
            changed = True
        if payload.hours_to_add is not None:
            item.hours_spent = (item.hours_spent or 0.0) + payload.hours_to_add
            changed = True
        if changed:
            item.is_user_corrected = True

    db.commit()
    for item in items:
        db.refresh(item)

    try:
        chroma_service.upsert_work_items(items, current_user.id)
    except Exception as exc:
        logger.error("ChromaDB sync on bulk-update failed: %s", exc)

    return [WorkItemResponse.model_validate(i) for i in items]
