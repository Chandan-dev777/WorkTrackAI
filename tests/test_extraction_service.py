"""
Unit tests for extraction_service using a mocked LLM.

We never call the real LLM in tests — the LangChain chain is patched
so we can test parsing logic, clarification detection, and failure handling.
"""

import json
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from backend.schemas.extraction import ExtractionResult, WorkItemExtracted
from backend.services.extraction_service import run_extraction


def _make_llm_response(data: dict) -> MagicMock:
    """Create a mock LLM response that returns JSON string content."""
    msg = MagicMock()
    msg.content = json.dumps(data)
    return msg


VALID_EXTRACTION_DATA = {
    "work_date": date.today().isoformat(),
    "items": [
        {
            "task_description": "Fixed login bug",
            "work_category": "ticket",
            "hours_spent": 2.0,
            "status": "done",
            "priority": "high",
            "ticket_id": "BUG-101",
            "confidence_score": 0.95,
            "clarification_needed": False,
        },
        {
            "task_description": "Attended daily standup",
            "work_category": "meeting",
            "hours_spent": 0.5,
            "status": "done",
            "confidence_score": 0.99,
            "clarification_needed": False,
        },
    ],
    "total_hours_warning": False,
}


class TestRunExtractionSuccess:
    def test_returns_extraction_result(self):
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.return_value = ExtractionResult.model_validate(VALID_EXTRACTION_DATA)
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, status, model = run_extraction("Fixed login bug (2h) and standup (0.5h)")

        assert result is not None
        assert status == "success"
        assert len(result.items) == 2

    def test_multiple_items_parsed(self):
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.return_value = ExtractionResult.model_validate(VALID_EXTRACTION_DATA)
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, _, _ = run_extraction("compound update")

        assert result.items[0].work_category == "ticket"
        assert result.items[1].work_category == "meeting"

    def test_hours_warning_set_when_over_12(self):
        data = {
            "work_date": date.today().isoformat(),
            "items": [
                {
                    "task_description": "Long day",
                    "work_category": "project",
                    "hours_spent": 13.0,
                    "status": "in_progress",
                    "clarification_needed": False,
                    "confidence_score": 0.8,
                }
            ],
            "total_hours_warning": False,
        }
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.return_value = ExtractionResult.model_validate(data)
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, _, _ = run_extraction("Worked 13 hours on project")

        assert result.total_hours_warning is True

    def test_work_date_override(self):
        override_date = date(2026, 1, 15)
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.return_value = ExtractionResult.model_validate(VALID_EXTRACTION_DATA)
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, _, _ = run_extraction("some update", work_date=override_date)

        assert result.work_date == override_date


class TestRunExtractionClarification:
    def test_needs_review_when_clarification_needed(self):
        data = {
            "work_date": date.today().isoformat(),
            "items": [
                {
                    "task_description": "Worked on Polaris stuff",
                    "work_category": "polaris_classification",
                    "hours_spent": None,
                    "status": None,
                    "clarification_needed": True,
                    "clarification_reason": "Hours and status not mentioned",
                    "confidence_score": 0.6,
                }
            ],
            "total_hours_warning": False,
        }
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.return_value = ExtractionResult.model_validate(data)
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, status, _ = run_extraction("Worked on Polaris stuff")

        assert status == "needs_review"
        assert result.items[0].clarification_needed is True


class TestRunExtractionFailure:
    def test_returns_none_on_exception(self):
        with patch("backend.services.extraction_service.build_extraction_chain") as mock_build:
            chain = MagicMock()
            chain.invoke.side_effect = Exception("LLM timeout")
            mock_build.return_value = (chain, MagicMock(), MagicMock())

            result, status, _ = run_extraction("some text")

        assert result is None
        assert status == "failed"


class TestFallbackExtraction:
    def test_fallback_preserves_raw_message(self):
        from backend.services.extraction_service import fallback_extraction
        raw = "fixed preprocessing issues of chatbot, it took 2 hours and its completed."
        result = fallback_extraction(raw, date.today())

        assert result is not None
        assert len(result.items) == 1
        assert raw.strip() in result.items[0].task_description

    def test_fallback_sets_clarification_needed(self):
        from backend.services.extraction_service import fallback_extraction
        result = fallback_extraction("some update", date.today())

        item = result.items[0]
        assert item.clarification_needed is True
        assert item.clarification_reason is not None
        assert item.hours_spent is None
        assert item.status is None

    def test_fallback_uses_other_category(self):
        from backend.services.extraction_service import fallback_extraction
        result = fallback_extraction("did some work", date.today())
        assert result.items[0].work_category == "other"

    def test_submit_uses_fallback_when_llm_fails(self, client, monkeypatch):
        """Router must return a preview (not 422) when LLM is unavailable."""
        from tests.conftest import register_user
        monkeypatch.setattr("backend.routers.updates.upsert_work_items", lambda *a, **kw: None)
        monkeypatch.setattr(
            "backend.routers.updates.run_extraction",
            lambda **kwargs: (None, "failed", "Claude Sonnet 4.6"),
        )
        token = register_user(client)

        resp = client.post(
            "/updates/submit",
            json={"raw_message": "fixed preprocessing issues of chatbot, it took 2 hours"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200, resp.json()
        body = resp.json()
        assert body["extraction_status"] == "needs_review"
        assert body["has_clarification_needed"] is True
        assert len(body["items"]) == 1
        # Raw message preserved in the fallback item
        assert "preprocessing" in body["items"][0]["task_description"].lower()
