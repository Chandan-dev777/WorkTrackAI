"""Integration tests for /dashboard/* and /worklogs/* routers."""

import uuid
from datetime import date, timedelta

import pytest

from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from tests.conftest import register_user

TODAY = date.today().isoformat()
LAST_WEEK = (date.today() - timedelta(days=6)).isoformat()


def _seed_items(client, token, count=2, hours=2.0):
    """Submit + confirm a work log with `count` confirmed items."""
    from unittest.mock import MagicMock
    # Use the test client directly with DB items
    return token  # items seeded via DB helper in specific tests


def _create_confirmed_log(db, user_id, employee_id, work_date=None):
    """Directly create a confirmed WorkLog with items in the test DB."""
    if work_date is None:
        work_date = date.today()
    log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        work_date=work_date,
        raw_message="test update",
        extraction_status="success",
    )
    db.add(log)
    db.flush()
    items = [
        WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=employee_id,
            work_date=work_date,
            task_description="Fixed login bug",
            work_category="ticket",
            hours_spent=2.0,
            status="done",
        ),
        WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=employee_id,
            work_date=work_date,
            task_description="Attended standup",
            work_category="meeting",
            hours_spent=0.5,
            status="done",
        ),
    ]
    for item in items:
        db.add(item)
    db.commit()
    return log, items


class TestDashboardSummary:
    def test_summary_returns_correct_totals(self, client, db):
        token = register_user(client)
        # Get user_id from /auth/me
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        user_id = me.json()["id"]
        employee_id = me.json()["employee_id"]

        _create_confirmed_log(db, user_id, employee_id)

        resp = client.get(
            f"/dashboard/summary?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_hours"] == 2.5
        assert body["done_count"] == 2
        assert body["total_items"] == 2

    def test_summary_requires_auth(self, client):
        resp = client.get("/dashboard/summary")
        assert resp.status_code in (401, 403)

    def test_summary_empty_range_returns_zeros(self, client, db):
        token = register_user(client)
        resp = client.get(
            f"/dashboard/summary?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["total_hours"] == 0.0


class TestDashboardCategories:
    def test_categories_groups_correctly(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get(
            f"/dashboard/categories?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        cats = {item["category"] for item in resp.json()}
        assert "ticket" in cats
        assert "meeting" in cats

    def test_categories_only_own_data(self, client, db):
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")
        me_b = client.get("/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()
        _create_confirmed_log(db, me_b["id"], me_b["employee_id"])

        resp = client.get(
            f"/dashboard/categories?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert resp.status_code == 200
        assert resp.json() == []


class TestDashboardStatus:
    def test_status_distribution(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get(
            f"/dashboard/status?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        statuses = {item["status"]: item["count"] for item in resp.json()}
        assert statuses.get("done", 0) == 2


class TestDashboardTrend:
    def test_trend_returns_daily_entries(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get(
            f"/dashboard/trend?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert len(resp.json()) >= 1
        assert resp.json()[0]["hours"] == 2.5


class TestTeamDashboard:
    def test_team_summary_requires_manager_role(self, client):
        token = register_user(client, role="employee")
        resp = client.get(
            f"/dashboard/team/summary?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_manager_can_access_team_summary(self, client):
        token = register_user(client, role="manager")
        resp = client.get(
            f"/dashboard/team/summary?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_team_categories_requires_manager(self, client):
        token = register_user(client, role="employee")
        resp = client.get(
            f"/dashboard/team/categories?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_employees_endpoint_requires_manager(self, client):
        token = register_user(client, role="employee")
        resp = client.get(
            f"/dashboard/employees?start_date={LAST_WEEK}&end_date={TODAY}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestWorklogsRouter:
    def test_list_my_items(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get("/worklogs/my", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_my_items_filter_by_status(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get(
            "/worklogs/my?status=done",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert all(item["status"] == "done" for item in resp.json())

    def test_list_my_items_filter_by_category(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _create_confirmed_log(db, me["id"], me["employee_id"])

        resp = client.get(
            "/worklogs/my?work_category=ticket",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert all(item["work_category"] == "ticket" for item in resp.json())

    def test_team_items_requires_manager(self, client):
        token = register_user(client, role="employee")
        resp = client.get("/worklogs/team", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_manager_can_list_team_items(self, client, db):
        mgr_token = register_user(client, role="manager", employee_id="MGR-001", email="mgr@x.com")
        emp_token = register_user(client, role="employee", employee_id="EMP-001", email="emp@x.com")
        me_emp = client.get("/auth/me", headers={"Authorization": f"Bearer {emp_token}"}).json()
        _create_confirmed_log(db, me_emp["id"], me_emp["employee_id"])

        resp = client.get("/worklogs/team", headers={"Authorization": f"Bearer {mgr_token}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_update_work_item(self, client, db):
        token = register_user(client)
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        _, items = _create_confirmed_log(db, me["id"], me["employee_id"])
        item_id = items[0].id

        resp = client.put(
            f"/worklogs/{item_id}",
            json={"hours_spent": 3.0, "status": "in_progress"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["hours_spent"] == 3.0
        assert body["status"] == "in_progress"
        assert body["is_user_corrected"] is True

    def test_update_other_users_item_returns_404(self, client, db):
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")
        me_a = client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
        _, items = _create_confirmed_log(db, me_a["id"], me_a["employee_id"])
        item_id = items[0].id

        resp = client.put(
            f"/worklogs/{item_id}",
            json={"hours_spent": 99.0},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404

    def test_update_nonexistent_item_returns_404(self, client):
        token = register_user(client)
        resp = client.put(
            "/worklogs/nonexistent-id",
            json={"hours_spent": 1.0},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404
