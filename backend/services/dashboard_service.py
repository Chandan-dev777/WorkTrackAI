"""
Dashboard aggregation service.

All employee queries are scoped to user_id.
Manager queries scope to all active users, optionally filtered by team_name.
SQLite is the source of truth — no ChromaDB needed here.
"""

import logging
from datetime import date
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.schemas.dashboard import (
    CategoryHours,
    DailyHours,
    HoursSummary,
    StatusCount,
    TeamMemberSummary,
)

logger = logging.getLogger(__name__)


def _employee_items_query(db: Session, user_id: str, start_date: date, end_date: date):
    """Base SQLAlchemy query for work items belonging to a single employee."""
    return (
        db.query(WorkItem)
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
        )
    )


def get_hours_summary(
    db: Session,
    user_id: str,
    start_date: date,
    end_date: date,
) -> HoursSummary:
    items = _employee_items_query(db, user_id, start_date, end_date).all()
    total_hours = sum(i.hours_spent or 0 for i in items)
    return HoursSummary(
        total_hours=round(total_hours, 2),
        done_count=sum(1 for i in items if i.status == "done"),
        in_progress_count=sum(1 for i in items if i.status == "in_progress"),
        blocked_count=sum(1 for i in items if i.status == "blocked"),
        planned_count=sum(1 for i in items if i.status == "planned"),
        total_items=len(items),
        start_date=start_date,
        end_date=end_date,
    )


def get_hours_by_category(
    db: Session,
    user_id: str,
    start_date: date,
    end_date: date,
) -> list[CategoryHours]:
    rows = (
        db.query(
            WorkItem.work_category,
            func.sum(WorkItem.hours_spent).label("hours"),
            func.count(WorkItem.id).label("item_count"),
        )
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
        )
        .group_by(WorkItem.work_category)
        .order_by(func.sum(WorkItem.hours_spent).desc())
        .all()
    )
    return [
        CategoryHours(
            category=r.work_category,
            hours=round(float(r.hours or 0), 2),
            item_count=r.item_count,
        )
        for r in rows
    ]


def get_status_distribution(
    db: Session,
    user_id: str,
    start_date: date,
    end_date: date,
) -> list[StatusCount]:
    rows = (
        db.query(
            WorkItem.status,
            func.count(WorkItem.id).label("count"),
        )
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
            WorkItem.status.isnot(None),
        )
        .group_by(WorkItem.status)
        .all()
    )
    return [StatusCount(status=r.status, count=r.count) for r in rows]


def get_daily_trend(
    db: Session,
    user_id: str,
    start_date: date,
    end_date: date,
) -> list[DailyHours]:
    rows = (
        db.query(
            WorkItem.work_date,
            func.sum(WorkItem.hours_spent).label("hours"),
            func.count(WorkItem.id).label("item_count"),
        )
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
        )
        .group_by(WorkItem.work_date)
        .order_by(WorkItem.work_date)
        .all()
    )
    return [
        DailyHours(
            date=r.work_date,
            hours=round(float(r.hours or 0), 2),
            item_count=r.item_count,
        )
        for r in rows
    ]


def get_team_summary(
    db: Session,
    start_date: date,
    end_date: date,
    team_name: Optional[str] = None,
) -> list[TeamMemberSummary]:
    """Manager-only: per-employee summary across the team."""
    user_q = db.query(User).filter(User.is_active == True)  # noqa: E712
    if team_name:
        user_q = user_q.filter(User.team_name == team_name)
    users = user_q.all()

    result = []
    for user in users:
        items = _employee_items_query(db, user.id, start_date, end_date).all()
        last_log = (
            db.query(WorkLog.work_date)
            .filter(
                WorkLog.user_id == user.id,
                WorkLog.is_deleted == False,  # noqa: E712
                WorkLog.extraction_status == "success",
            )
            .order_by(WorkLog.work_date.desc())
            .first()
        )
        result.append(TeamMemberSummary(
            employee_id=user.employee_id,
            full_name=user.full_name,
            total_hours=round(sum(i.hours_spent or 0 for i in items), 2),
            done_count=sum(1 for i in items if i.status == "done"),
            blocked_count=sum(1 for i in items if i.status == "blocked"),
            last_activity=last_log.work_date if last_log else None,
        ))
    return result


def get_team_hours_by_category(
    db: Session,
    start_date: date,
    end_date: date,
    team_name: Optional[str] = None,
) -> list[CategoryHours]:
    """Manager-only: category breakdown across the team."""
    user_ids_q = db.query(User.id).filter(User.is_active == True)  # noqa: E712
    if team_name:
        user_ids_q = user_ids_q.filter(User.team_name == team_name)
    user_ids = [r.id for r in user_ids_q.all()]

    if not user_ids:
        return []

    rows = (
        db.query(
            WorkItem.work_category,
            func.sum(WorkItem.hours_spent).label("hours"),
            func.count(WorkItem.id).label("item_count"),
        )
        .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
        .filter(
            WorkLog.user_id.in_(user_ids),
            WorkLog.is_deleted == False,  # noqa: E712
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
        )
        .group_by(WorkItem.work_category)
        .order_by(func.sum(WorkItem.hours_spent).desc())
        .all()
    )
    return [
        CategoryHours(
            category=r.work_category,
            hours=round(float(r.hours or 0), 2),
            item_count=r.item_count,
        )
        for r in rows
    ]
