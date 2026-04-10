"""Integration tests for /updates router with mocked extraction."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from backend.schemas.extraction import ExtractionResult, WorkItemExtracted
from tests.conftest import register_user


def _mock_extraction_success(monkeypatch):
    """Patch run_extraction to return a successful result."""
    result = ExtractionResult(
        work_date=date.today(),
        items=[
            WorkItemExtracted(
                task_description="Fixed login bug",
                work_category="ticket",
                hours_spent=2.0,
                status="done",
                ticket_id="BUG-101",
                confidence_score=0.95,
                clarification_needed=False,
            ),
            WorkItemExtracted(
                task_description="Attended standup",
                work_category="meeting",
                hours_spent=0.5,
                status="done",
                confidence_score=0.99,
                clarification_needed=False,
            ),
        ],
        total_hours_warning=False,
    )
    monkeypatch.setattr(
        "backend.routers.updates.run_extraction",
        lambda **kwargs: (result, "success", "Claude Sonnet 4.6"),
    )
    return result


def _mock_extraction_failure(monkeypatch):
    monkeypatch.setattr(
        "backend.routers.updates.run_extraction",
        lambda **kwargs: (None, "failed", "Claude Sonnet 4.6"),
    )


def _mock_chroma(monkeypatch):
    monkeypatch.setattr("backend.routers.updates.upsert_work_items", lambda *a, **kw: None)
    monkeypatch.setattr("backend.routers.updates.delete_work_log", lambda *a, **kw: None)


class TestSubmitUpdate:
    def test_submit_returns_preview(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        token = register_user(client)

        resp = client.post(
            "/updates/submit",
            json={"raw_message": "Fixed login bug (2h) and standup (0.5h)"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "work_log_id" in body
        assert len(body["items"]) == 2
        assert body["extraction_status"] == "success"
        assert body["total_hours_warning"] is False
        assert body["has_clarification_needed"] is False

    def test_submit_requires_auth(self, client):
        resp = client.post("/updates/submit", json={"raw_message": "some update"})
        assert resp.status_code in (401, 403)

    def test_submit_llm_failure_returns_fallback_preview(self, client, monkeypatch):
        """When LLM fails, submit still returns a 200 preview for manual completion."""
        _mock_chroma(monkeypatch)
        _mock_extraction_failure(monkeypatch)
        token = register_user(client)

        resp = client.post(
            "/updates/submit",
            json={"raw_message": "fixed preprocessing issues of chatbot"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["extraction_status"] == "needs_review"
        assert body["has_clarification_needed"] is True
        assert len(body["items"]) == 1

    def test_submit_with_explicit_work_date(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        token = register_user(client)

        resp = client.post(
            "/updates/submit",
            json={"raw_message": "worked on X", "work_date": "2026-01-15"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200


class TestConfirmUpdate:
    def _submit_and_get_log_id(self, client, token, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        resp = client.post(
            "/updates/submit",
            json={"raw_message": "Fixed bug and standup"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        return resp.json()["work_log_id"], resp.json()["items"]

    def test_confirm_persists_items(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        token = register_user(client)
        log_id, items = self._submit_and_get_log_id(client, token, monkeypatch)

        resp = client.put(
            f"/updates/{log_id}/confirm",
            json={"items": items, "work_date": date.today().isoformat()},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["extraction_status"] == "success"
        assert len(body["work_items"]) == 2

    def test_confirm_unknown_log_returns_404(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        token = register_user(client)

        resp = client.put(
            "/updates/nonexistent-id/confirm",
            json={
                "items": [{
                    "task_description": "x",
                    "work_category": "other",
                    "clarification_needed": False,
                }],
                "work_date": date.today().isoformat(),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_confirm_other_users_log_returns_404(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        token_a = register_user(client, employee_id="EMP-001", email="a@x.com")
        token_b = register_user(client, employee_id="EMP-002", email="b@x.com")

        log_id, items = self._submit_and_get_log_id(client, token_a, monkeypatch)

        resp = client.put(
            f"/updates/{log_id}/confirm",
            json={"items": items, "work_date": date.today().isoformat()},
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert resp.status_code == 404


class TestListAndGetUpdates:
    def test_list_returns_own_logs(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        token = register_user(client)

        client.post(
            "/updates/submit",
            json={"raw_message": "did some work"},
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = client.get("/updates/", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_get_own_log(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        token = register_user(client)

        submit_resp = client.post(
            "/updates/submit",
            json={"raw_message": "did some work"},
            headers={"Authorization": f"Bearer {token}"},
        )
        log_id = submit_resp.json()["work_log_id"]

        resp = client.get(f"/updates/{log_id}", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["id"] == log_id

    def test_delete_soft_deletes(self, client, monkeypatch):
        _mock_chroma(monkeypatch)
        _mock_extraction_success(monkeypatch)
        token = register_user(client)

        submit_resp = client.post(
            "/updates/submit",
            json={"raw_message": "did some work"},
            headers={"Authorization": f"Bearer {token}"},
        )
        log_id = submit_resp.json()["work_log_id"]

        del_resp = client.delete(
            f"/updates/{log_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert del_resp.status_code == 204

        # Should no longer appear in list
        list_resp = client.get("/updates/", headers={"Authorization": f"Bearer {token}"})
        assert all(log["id"] != log_id for log in list_resp.json())
