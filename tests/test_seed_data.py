"""Tests for backend/seed_data.py."""

import pytest

from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.seed_data import seed, seed_work_logs


class TestSeedUsers:
    def test_creates_expected_user_count(self, db):
        """16 users total: 1 admin + 3 managers + 12 employees."""
        seed(db)
        total = db.query(User).count()
        assert total == 16

    def test_creates_one_admin(self, db):
        seed(db)
        admins = db.query(User).filter(User.role == "admin").all()
        assert len(admins) == 1
        assert admins[0].employee_id == "ADMIN-001"

    def test_creates_three_managers(self, db):
        seed(db)
        managers = db.query(User).filter(User.role == "manager").all()
        assert len(managers) == 3

    def test_creates_twelve_employees(self, db):
        seed(db)
        employees = db.query(User).filter(User.role == "employee").all()
        assert len(employees) == 12

    def test_employees_have_team_names(self, db):
        seed(db)
        employees = db.query(User).filter(User.role == "employee").all()
        for emp in employees:
            assert emp.team_name in ("Engineering", "Data", "Support")

    def test_employees_have_manager_id(self, db):
        seed(db)
        employees = db.query(User).filter(User.role == "employee").all()
        for emp in employees:
            assert emp.manager_id is not None

    def test_seed_is_idempotent(self, db):
        """Calling seed twice must not create duplicate users."""
        result1 = seed(db)
        result2 = seed(db)
        assert result1 == 16
        assert result2 == 0  # skipped
        assert db.query(User).count() == 16

    def test_returns_zero_when_already_seeded(self, db):
        seed(db)
        result = seed(db)
        assert result == 0


class TestSeedWorkLogs:
    def test_creates_work_logs(self, db):
        """After seeding users, work log seed must create logs."""
        seed(db)
        logs = db.query(WorkLog).count()
        assert logs > 0

    def test_creates_work_items(self, db):
        """Work items must be created for each log."""
        seed(db)
        items = db.query(WorkItem).count()
        assert items > 0

    def test_work_items_exceed_minimum_threshold(self, db):
        """With 12 employees × ~22 weekdays × 1-3 tasks, expect at least 200 items."""
        seed(db)
        items = db.query(WorkItem).count()
        assert items >= 200

    def test_work_logs_have_success_or_needs_review_status(self, db):
        seed(db)
        logs = db.query(WorkLog).all()
        statuses = {log.extraction_status for log in logs}
        assert statuses.issubset({"success", "needs_review"})
        assert "success" in statuses

    def test_some_items_have_blocked_status(self, db):
        """Seed templates include blocked items — at least some must appear."""
        seed(db)
        blocked = db.query(WorkItem).filter(WorkItem.status == "blocked").count()
        assert blocked > 0

    def test_items_have_valid_work_categories(self, db):
        seed(db)
        valid_categories = {
            "project", "ticket", "polaris_classification", "admin",
            "meeting", "learning", "support", "documentation", "review", "other",
        }
        items = db.query(WorkItem).all()
        for item in items:
            assert item.work_category in valid_categories

    def test_work_log_seed_is_idempotent(self, db):
        """Calling seed_work_logs twice must not duplicate logs."""
        seed(db)
        count_after_first = db.query(WorkLog).count()
        seed_work_logs(db)
        count_after_second = db.query(WorkLog).count()
        assert count_after_first == count_after_second

    def test_items_span_multiple_employees(self, db):
        """Work items must be distributed across multiple employees."""
        seed(db)
        employee_ids = db.query(WorkItem.employee_id).distinct().all()
        assert len(employee_ids) >= 10

    def test_items_span_multiple_dates(self, db):
        """Work items must span at least 5 distinct dates."""
        seed(db)
        dates = db.query(WorkItem.work_date).distinct().all()
        assert len(dates) >= 5
