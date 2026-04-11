"""Tests for updates CRUD that wasn't covered by test_updates_router.py.

Focuses on: list pagination, date filtering, re-edit flow.
"""

from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest

from backend.schemas.extraction import ExtractionResult, WorkItemExtracted
from tests.conftest import register_user


def _mock_extraction(monkeypatch):
    result = ExtractionResult(
        work_date=date.today(),
        items=[
            WorkItemExtracted(
                task_description="Task A",
                work_category="ticket",
                hours_spent=2.0,
                status="done",
                confidence_score=0.9,
                clarification_needed=False,
            )
        ],
        total_hours_warning=False,
    )
    monkeypatch.setattr(
        "backend.routers.updates.run_extraction",
        lambda **kwargs: (result, "success", "Claude Sonnet 4.6"),
    )
    monkeypatch.setattr("backend.routers.updates.upsert_work_items", lambda *a, **kw: None)
    monkeypatch.setattr("backend.routers.updates.delete_work_log", lambda *a, **kw: None)
    return result


def _submit_and_confirm(client, token, monkeypatch, raw="Did some work"):
    submit = client.post(
        "/updates/submit",
        json={"raw_message": raw},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert submit.status_code == 200
    log_id = submit.json()["work_log_id"]
    items = submit.json()["items"]

    confirm = client.put(
        f"/updates/{log_id}/confirm",
        json={"items": items, "work_date": date.today().isoformat()},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert confirm.status_code == 200
    return log_id


class TestListPagination:
    def test_pagination_skip_and_limit(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token = register_user(client)

        for i in range(3):
            _submit_and_confirm(client, token, monkeypatch, raw=f"Work item {i}")

        resp_all = client.get(
            "/updates/?limit=3",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(resp_all.json()) == 3

        resp_skip = client.get(
            "/updates/?skip=2&limit=3",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert len(resp_skip.json()) == 1

    def test_list_excludes_other_users(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")

        _submit_and_confirm(client, token_a, monkeypatch)

        resp = client.get("/updates/", headers={"Authorization": f"Bearer {token_b}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestGetUpdate:
    def test_get_own_log_returns_full_detail(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token = register_user(client)
        log_id = _submit_and_confirm(client, token, monkeypatch)

        resp = client.get(
            f"/updates/{log_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == log_id
        assert len(body["work_items"]) == 1

    def test_get_other_users_log_returns_404(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")

        log_id = _submit_and_confirm(client, token_a, monkeypatch)

        resp = client.get(
            f"/updates/{log_id}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404


class TestResubmitUpdate:
    def test_resubmit_returns_new_work_log_id(self, client, monkeypatch):
        """PUT /updates/{id} creates a new log and returns a different work_log_id."""
        _mock_extraction(monkeypatch)
        token = register_user(client)
        old_id = _submit_and_confirm(client, token, monkeypatch)

        resp = client.put(
            f"/updates/{old_id}",
            json={"raw_message": "Updated work description"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "work_log_id" in body
        assert body["work_log_id"] != old_id

    def test_resubmit_soft_deletes_old_log(self, client, monkeypatch):
        """After resubmit the old log no longer appears in GET /updates/."""
        _mock_extraction(monkeypatch)
        token = register_user(client)
        old_id = _submit_and_confirm(client, token, monkeypatch)

        client.put(
            f"/updates/{old_id}",
            json={"raw_message": "New message"},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = client.get(f"/updates/{old_id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 404

    def test_resubmit_new_log_appears_in_list(self, client, monkeypatch):
        """The new log from resubmit is visible in GET /updates/."""
        _mock_extraction(monkeypatch)
        token = register_user(client)
        old_id = _submit_and_confirm(client, token, monkeypatch)

        resubmit_resp = client.put(
            f"/updates/{old_id}",
            json={"raw_message": "New message"},
            headers={"Authorization": f"Bearer {token}"},
        )
        new_id = resubmit_resp.json()["work_log_id"]

        list_resp = client.get("/updates/", headers={"Authorization": f"Bearer {token}"})
        ids = [log["id"] for log in list_resp.json()]
        assert new_id in ids
        assert old_id not in ids

    def test_resubmit_unknown_log_returns_404(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token = register_user(client)

        resp = client.put(
            "/updates/nonexistent-id",
            json={"raw_message": "Anything"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_resubmit_other_users_log_returns_404(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")
        old_id = _submit_and_confirm(client, token_a, monkeypatch)

        resp = client.put(
            f"/updates/{old_id}",
            json={"raw_message": "Trying to steal"},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404


class TestDoubleConfirmBlocked:
    def test_second_confirm_returns_409(self, client, monkeypatch):
        _mock_extraction(monkeypatch)
        token = register_user(client)
        log_id = _submit_and_confirm(client, token, monkeypatch)

        # Try confirming again
        resp = client.put(
            f"/updates/{log_id}/confirm",
            json={
                "items": [{"task_description": "x", "work_category": "other", "clarification_needed": False}],
                "work_date": date.today().isoformat(),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409
