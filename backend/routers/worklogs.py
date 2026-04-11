"""
Worklogs router.

GET  /worklogs/my          — own work items with optional filters
GET  /worklogs/team        — team work items (manager+)
PUT  /worklogs/{item_id}   — edit a single work item
"""

import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.routers.auth import get_current_user, require_role
from backend.schemas.work_item import WorkItemResponse, WorkItemUpdate

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

    return WorkItemResponse.model_validate(item)
