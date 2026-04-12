"""Integration tests for /admin/* router endpoints."""

import uuid
from datetime import date
from unittest.mock import patch

import pytest

from tests.conftest import register_user
from backend.models.user import User
from backend.models.work_log import WorkLog
from backend.services.auth_service import hash_password


def _admin_token(client):
    return register_user(client, employee_id="ADMIN-001", role="admin", email="admin@x.com")


def _manager_token(client):
    return register_user(client, employee_id="MGR-001", role="manager", email="mgr@x.com")


def _employee_token(client):
    return register_user(client, employee_id="EMP-001", role="employee", email="emp@x.com")


# ── Role guard tests ──────────────────────────────────────────────────────────

class TestAdminRoleGuards:
    def test_seed_requires_admin_employee_gets_403(self, client):
        token = _employee_token(client)
        resp = client.post("/admin/seed-dummy-data", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_seed_requires_admin_manager_gets_403(self, client):
        token = _manager_token(client)
        resp = client.post("/admin/seed-dummy-data", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_extraction_errors_requires_admin_employee_gets_403(self, client):
        token = _employee_token(client)
        resp = client.get("/admin/extraction-errors", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_reindex_requires_admin_employee_gets_403(self, client):
        token = _employee_token(client)
        resp = client.post("/admin/reindex", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_list_users_requires_admin_employee_gets_403(self, client):
        token = _employee_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_list_users_requires_admin_manager_gets_403(self, client):
        token = _manager_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_all_endpoints_require_auth(self, client):
        for method, path in [
            ("POST", "/admin/seed-dummy-data"),
            ("GET", "/admin/extraction-errors"),
            ("POST", "/admin/reindex"),
            ("GET", "/admin/users"),
        ]:
            resp = client.request(method, path)
            assert resp.status_code in (401, 403), f"{method} {path} should require auth"


# ── GET /admin/users ──────────────────────────────────────────────────────────

class TestAdminListUsers:
    def test_returns_all_users(self, client):
        _employee_token(client)  # registers EMP-001
        token = _admin_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        # admin + employee were registered
        assert len(data) >= 2

    def test_response_has_expected_fields(self, client):
        token = _admin_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        for user in resp.json():
            assert "employee_id" in user
            assert "full_name" in user
            assert "email" in user
            assert "role" in user

    def test_empty_db_returns_only_admin(self, client):
        token = _admin_token(client)
        resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ── GET /admin/extraction-errors ─────────────────────────────────────────────

class TestAdminExtractionErrors:
    def test_returns_empty_when_no_errors(self, client):
        token = _admin_token(client)
        resp = client.get("/admin/extraction-errors", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_failed_and_needs_review_logs(self, client, db):
        token = _admin_token(client)
        emp = User(
            employee_id="EMP-ERR", full_name="Err User", email="err@x.com",
            hashed_password=hash_password("pw"), role="employee",
        )
        db.add(emp)
        db.flush()

        for status in ["failed", "needs_review", "success"]:
            db.add(WorkLog(
                id=str(uuid.uuid4()),
                user_id=emp.id,
                work_date=date.today(),
                raw_message=f"msg for {status}",
                extraction_status=status,
            ))
        db.commit()

        resp = client.get("/admin/extraction-errors", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        statuses = {r["extraction_status"] for r in data}
        # Should include failed and needs_review, NOT success
        assert "failed" in statuses
        assert "needs_review" in statuses
        assert "success" not in statuses

    def test_response_has_expected_fields(self, client, db):
        token = _admin_token(client)
        emp = User(
            employee_id="EMP-ERR2", full_name="Err2", email="err2@x.com",
            hashed_password=hash_password("pw"), role="employee",
        )
        db.add(emp)
        db.flush()
        db.add(WorkLog(
            id=str(uuid.uuid4()),
            user_id=emp.id,
            work_date=date.today(),
            raw_message="bad parse",
            extraction_status="failed",
        ))
        db.commit()

        resp = client.get("/admin/extraction-errors", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        row = resp.json()[0]
        assert "id" in row
        assert "employee_id" in row
        assert "work_date" in row
        assert "extraction_status" in row
        assert "raw_message" in row
        assert "submitted_at" in row


# ── POST /admin/reindex ───────────────────────────────────────────────────────

class TestAdminReindex:
    def test_reindex_returns_count(self, client):
        token = _admin_token(client)
        with patch("backend.routers.admin.reindex_from_sqlite", return_value=42):
            resp = client.post("/admin/reindex", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["indexed"] == 42
        assert "message" in data

    def test_reindex_empty_db_returns_zero(self, client):
        token = _admin_token(client)
        with patch("backend.routers.admin.reindex_from_sqlite", return_value=0):
            resp = client.post("/admin/reindex", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["indexed"] == 0


# ── POST /admin/seed-dummy-data ───────────────────────────────────────────────

class TestAdminSeedDummyData:
    def test_seed_returns_created_count(self, client):
        token = _admin_token(client)
        with patch("backend.routers.admin.seed", return_value=16) as mock_seed:
            resp = client.post("/admin/seed-dummy-data", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        mock_seed.assert_called_once()

    def test_seed_idempotent_second_call_returns_skipped_message(self, client):
        """Second seed call should not raise — seed() is idempotent (skips if users exist)."""
        token = _admin_token(client)
        with patch("backend.routers.admin.seed", return_value=0):
            resp = client.post("/admin/seed-dummy-data", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


# ── PUT /admin/users/{user_id} ────────────────────────────────────────────────

class TestAdminUpdateUser:
    def test_admin_can_change_user_role(self, client):
        _employee_token(client)  # registers EMP-001
        token = _admin_token(client)

        # Get employee user id
        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        emp = next(u for u in users_resp.json() if u["employee_id"] == "EMP-001")

        resp = client.put(
            f"/admin/users/{emp['id']}",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "manager"

    def test_admin_can_deactivate_user(self, client):
        _employee_token(client)
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        emp = next(u for u in users_resp.json() if u["employee_id"] == "EMP-001")

        resp = client.put(
            f"/admin/users/{emp['id']}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    def test_admin_can_reactivate_user(self, client):
        _employee_token(client)
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        emp = next(u for u in users_resp.json() if u["employee_id"] == "EMP-001")

        # Deactivate first
        client.put(
            f"/admin/users/{emp['id']}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Reactivate
        resp = client.put(
            f"/admin/users/{emp['id']}",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    def test_admin_cannot_change_own_role(self, client):
        """Admin must not be able to demote themselves — prevents self-lockout."""
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        admin_user = next(u for u in users_resp.json() if u["role"] == "admin")

        resp = client.put(
            f"/admin/users/{admin_user['id']}",
            json={"role": "employee"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_admin_cannot_deactivate_self(self, client):
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        admin_user = next(u for u in users_resp.json() if u["role"] == "admin")

        resp = client.put(
            f"/admin/users/{admin_user['id']}",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_update_nonexistent_user_returns_404(self, client):
        token = _admin_token(client)
        resp = client.put(
            "/admin/users/00000000-0000-0000-0000-000000000000",
            json={"role": "manager"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_employee_cannot_update_user_role(self, client):
        token = _employee_token(client)
        resp = client.put(
            "/admin/users/any-id",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_invalid_role_returns_422(self, client):
        _employee_token(client)
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        emp = next(u for u in users_resp.json() if u["employee_id"] == "EMP-001")

        resp = client.put(
            f"/admin/users/{emp['id']}",
            json={"role": "superuser"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_can_update_role_and_team_together(self, client):
        _employee_token(client)
        token = _admin_token(client)

        users_resp = client.get("/admin/users", headers={"Authorization": f"Bearer {token}"})
        emp = next(u for u in users_resp.json() if u["employee_id"] == "EMP-001")

        resp = client.put(
            f"/admin/users/{emp['id']}",
            json={"role": "manager", "team_name": "Engineering"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "manager"
        assert data["team_name"] == "Engineering"
