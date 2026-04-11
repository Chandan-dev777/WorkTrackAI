"""
Dashboard router.

GET /dashboard/summary           — KPI summary for current user
GET /dashboard/categories        — hours by category
GET /dashboard/status            — status distribution
GET /dashboard/trend             — daily hours trend
GET /dashboard/team/summary      — team per-employee summary (manager+)
GET /dashboard/team/categories   — team hours by category (manager+)
GET /dashboard/employees         — all employees with activity summary (manager+)
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.routers.auth import get_current_user, require_role
from backend.schemas.dashboard import (
    CategoryHours,
    DailyHours,
    HoursSummary,
    StatusCount,
    TeamMemberSummary,
)
from backend.services.dashboard_service import (
    get_daily_trend,
    get_hours_by_category,
    get_hours_summary,
    get_status_distribution,
    get_team_hours_by_category,
    get_team_summary,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _default_range() -> tuple[date, date]:
    today = date.today()
    # Default to current week (Mon–Sun)
    start = today - timedelta(days=today.weekday())
    return start, today


@router.get("/summary", response_model=HoursSummary)
def dashboard_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HoursSummary:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_hours_summary(db, current_user.id, s, e)


@router.get("/categories", response_model=list[CategoryHours])
def dashboard_categories(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CategoryHours]:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_hours_by_category(db, current_user.id, s, e)


@router.get("/status", response_model=list[StatusCount])
def dashboard_status(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StatusCount]:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_status_distribution(db, current_user.id, s, e)


@router.get("/trend", response_model=list[DailyHours])
def dashboard_trend(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DailyHours]:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_daily_trend(db, current_user.id, s, e)


@router.get("/team/summary", response_model=list[TeamMemberSummary])
def team_summary(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    team_name: Optional[str] = Query(None),
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[TeamMemberSummary]:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_team_summary(db, s, e, team_name)


@router.get("/team/categories", response_model=list[CategoryHours])
def team_categories(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    team_name: Optional[str] = Query(None),
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[CategoryHours]:
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_team_hours_by_category(db, s, e, team_name)


@router.get("/employees", response_model=list[TeamMemberSummary])
def list_employees(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    team_name: Optional[str] = Query(None),
    current_user: User = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[TeamMemberSummary]:
    """All employees with their activity summary — alias for team/summary."""
    s, e = start_date, end_date
    if not s or not e:
        s, e = _default_range()
    return get_team_summary(db, s, e, team_name)
