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
