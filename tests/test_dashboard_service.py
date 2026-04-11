"""Unit tests for dashboard_service.py aggregation queries."""

import uuid
from datetime import date, timedelta

import pytest

from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.models.user import User
from backend.services.dashboard_service import (
    get_daily_trend,
    get_hours_by_category,
    get_hours_summary,
    get_status_distribution,
    get_team_hours_by_category,
    get_team_summary,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(db, employee_id="EMP-001", role="employee", team_name="Engineering"):
    user = User(
        employee_id=employee_id,
        full_name=f"User {employee_id}",
        email=f"{employee_id.lower()}@example.com",
        hashed_password="hashed",
        role=role,
        team_name=team_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_log_with_items(db, user, work_date, items_data):
    """Create a confirmed WorkLog with given items."""
    log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        work_date=work_date,
        raw_message="test",
        extraction_status="success",
    )
    db.add(log)
    db.flush()

    for d in items_data:
        item = WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=work_date,
            task_description=d.get("task_description", "Some task"),
            work_category=d.get("work_category", "other"),
            hours_spent=d.get("hours_spent"),
            status=d.get("status"),
        )
        db.add(item)
    db.commit()
    return log


TODAY = date.today()
YESTERDAY = TODAY - timedelta(days=1)
LAST_WEEK = TODAY - timedelta(days=7)


class TestGetHoursSummary:
    def test_sums_hours_correctly(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [
            {"hours_spent": 2.0, "status": "done", "work_category": "ticket"},
            {"hours_spent": 1.5, "status": "in_progress", "work_category": "meeting"},
        ])

        result = get_hours_summary(db, user.id, LAST_WEEK, TODAY)

        assert result.total_hours == 3.5
        assert result.done_count == 1
        assert result.in_progress_count == 1
        assert result.blocked_count == 0
        assert result.total_items == 2

    def test_empty_range_returns_zeros(self, db):
        user = _make_user(db)
        result = get_hours_summary(db, user.id, LAST_WEEK, TODAY)

        assert result.total_hours == 0.0
        assert result.total_items == 0

    def test_excludes_deleted_logs(self, db):
        user = _make_user(db)
        log = WorkLog(
            id=str(uuid.uuid4()),
            user_id=user.id,
            work_date=TODAY,
            raw_message="test",
            extraction_status="success",
            is_deleted=True,
        )
        db.add(log)
        db.flush()
        db.add(WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=TODAY,
            task_description="deleted task",
            work_category="other",
            hours_spent=5.0,
            status="done",
        ))
        db.commit()

        result = get_hours_summary(db, user.id, LAST_WEEK, TODAY)
        assert result.total_hours == 0.0

    def test_excludes_other_users(self, db):
        user_a = _make_user(db, "EMP-001")
        user_b = _make_user(db, "EMP-002")
        _make_log_with_items(db, user_b, TODAY, [{"hours_spent": 8.0, "status": "done"}])

        result = get_hours_summary(db, user_a.id, LAST_WEEK, TODAY)
        assert result.total_hours == 0.0

    def test_handles_null_hours(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [
            {"hours_spent": None, "status": "in_progress"},
            {"hours_spent": 2.0, "status": "done"},
        ])
        result = get_hours_summary(db, user.id, LAST_WEEK, TODAY)
        assert result.total_hours == 2.0


class TestGetHoursByCategory:
    def test_groups_by_category(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [
            {"work_category": "ticket", "hours_spent": 3.0},
            {"work_category": "ticket", "hours_spent": 1.0},
            {"work_category": "meeting", "hours_spent": 0.5},
        ])

        result = get_hours_by_category(db, user.id, LAST_WEEK, TODAY)
        cats = {r.category: r.hours for r in result}

        assert cats["ticket"] == 4.0
        assert cats["meeting"] == 0.5

    def test_returns_empty_list_when_no_data(self, db):
        user = _make_user(db)
        result = get_hours_by_category(db, user.id, LAST_WEEK, TODAY)
        assert result == []


class TestGetStatusDistribution:
    def test_counts_statuses(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [
            {"status": "done"}, {"status": "done"},
            {"status": "in_progress"},
            {"status": "blocked"},
        ])

        result = get_status_distribution(db, user.id, LAST_WEEK, TODAY)
        counts = {r.status: r.count for r in result}

        assert counts["done"] == 2
        assert counts["in_progress"] == 1
        assert counts["blocked"] == 1

    def test_excludes_null_status(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [{"status": None}, {"status": "done"}])

        result = get_status_distribution(db, user.id, LAST_WEEK, TODAY)
        assert all(r.status is not None for r in result)


class TestGetDailyTrend:
    def test_one_entry_per_day(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [{"hours_spent": 2.0}, {"hours_spent": 1.0}])
        _make_log_with_items(db, user, YESTERDAY, [{"hours_spent": 3.0}])

        result = get_daily_trend(db, user.id, LAST_WEEK, TODAY)
        dates = {r.date: r.hours for r in result}

        assert dates[TODAY] == 3.0
        assert dates[YESTERDAY] == 3.0

    def test_ordered_by_date_ascending(self, db):
        user = _make_user(db)
        _make_log_with_items(db, user, TODAY, [{"hours_spent": 1.0}])
        _make_log_with_items(db, user, YESTERDAY, [{"hours_spent": 2.0}])

        result = get_daily_trend(db, user.id, LAST_WEEK, TODAY)
        assert result[0].date <= result[-1].date


class TestTeamFunctions:
    def test_team_summary_includes_all_active_users(self, db):
        mgr = _make_user(db, "MGR-001", role="manager")
        emp1 = _make_user(db, "EMP-001")
        emp2 = _make_user(db, "EMP-002")
        _make_log_with_items(db, emp1, TODAY, [{"hours_spent": 4.0, "status": "done"}])

        result = get_team_summary(db, LAST_WEEK, TODAY)
        ids = {r.employee_id for r in result}

        assert "MGR-001" in ids
        assert "EMP-001" in ids
        assert "EMP-002" in ids

    def test_team_summary_filters_by_team_name(self, db):
        _make_user(db, "EMP-001", team_name="Engineering")
        _make_user(db, "EMP-002", team_name="Support")

        result = get_team_summary(db, LAST_WEEK, TODAY, team_name="Engineering")
        assert all(r.employee_id != "EMP-002" for r in result)

    def test_team_categories_aggregates_across_users(self, db):
        emp1 = _make_user(db, "EMP-001")
        emp2 = _make_user(db, "EMP-002")
        _make_log_with_items(db, emp1, TODAY, [{"work_category": "ticket", "hours_spent": 2.0}])
        _make_log_with_items(db, emp2, TODAY, [{"work_category": "ticket", "hours_spent": 3.0}])

        result = get_team_hours_by_category(db, LAST_WEEK, TODAY)
        cats = {r.category: r.hours for r in result}
        assert cats["ticket"] == 5.0
