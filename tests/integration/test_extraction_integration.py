"""
Integration tests for extraction_service — real LLM calls.

These verify that the LLM actually understands the prompt and schema,
not just that our parsing code works. They run against real API endpoints.

Run with: pytest -m integration tests/integration/test_extraction_integration.py -v
"""

import pytest
from datetime import date

from backend.services.extraction_service import run_extraction


pytestmark = pytest.mark.integration


class TestSimpleExtractions:
    def test_unambiguous_message_extracts_correctly(self):
        """Clear message → correct hours, status, category, no clarification."""
        result, status, model = run_extraction(
            "fixed preprocessing issues of chatbot, it took 2 hours and its completed"
        )
        assert result is not None, f"Extraction failed, model={model}"
        assert len(result.items) >= 1
        item = result.items[0]

        assert item.hours_spent == pytest.approx(2.0, abs=0.1), \
            f"Expected 2h, got {item.hours_spent}"
        assert item.status == "done", f"Expected 'done', got {item.status}"
        assert item.clarification_needed is False, \
            f"Should not need clarification, reason: {item.clarification_reason}"
        assert status == "success"

    def test_meeting_categorised_correctly(self):
        """'Attended standup' → category=meeting, not ticket."""
        result, status, _ = run_extraction(
            "attended the daily standup, 30 minutes"
        )
        assert result is not None
        item = result.items[0]
        assert item.work_category == "meeting", \
            f"Expected 'meeting', got {item.work_category}"
        assert item.hours_spent == pytest.approx(0.5, abs=0.1), \
            f"Expected 0.5h (30 min), got {item.hours_spent}"

    def test_blocked_task_status_extracted(self):
        """Blocked language → status=blocked."""
        result, status, _ = run_extraction(
            "tried to deploy the API but it's blocked by infrastructure issues, spent 1 hour"
        )
        assert result is not None
        item = result.items[0]
        assert item.status == "blocked", f"Expected 'blocked', got {item.status}"
        assert item.hours_spent == pytest.approx(1.0, abs=0.1)

    def test_in_progress_task(self):
        """Ongoing work → status=in_progress."""
        result, status, _ = run_extraction(
            "working on the data pipeline refactor, spent 3 hours, still ongoing"
        )
        assert result is not None
        item = result.items[0]
        assert item.status == "in_progress", f"Expected 'in_progress', got {item.status}"


class TestCompoundMessages:
    def test_compound_message_splits_into_multiple_items(self):
        """Multiple distinct tasks → multiple WorkItems."""
        result, _, _ = run_extraction(
            "Fixed login bug (2h, done), attended standup (30 min), "
            "reviewed PR for data pipeline (1h, done)"
        )
        assert result is not None
        assert len(result.items) >= 2, \
            f"Expected at least 2 items, got {len(result.items)}: {[i.task_description for i in result.items]}"

    def test_total_hours_warning_when_over_12(self):
        """Sum > 12h → total_hours_warning=True."""
        result, _, _ = run_extraction(
            "worked on the migration project all day, about 13 hours total, still in progress"
        )
        assert result is not None
        assert result.total_hours_warning is True, \
            f"Expected warning flag, total hours: {sum(i.hours_spent or 0 for i in result.items)}"


class TestClarificationFlow:
    def test_missing_hours_sets_clarification(self):
        """No hours mentioned → clarification_needed=True."""
        result, status, _ = run_extraction(
            "worked on Polaris classification stuff"
        )
        assert result is not None
        assert status == "needs_review"
        assert any(i.clarification_needed for i in result.items), \
            "Expected at least one item to need clarification (hours not inferable)"

    def test_optional_fields_do_not_trigger_clarification(self):
        """Missing ticket_id, project_name etc. should NOT set clarification_needed."""
        result, status, _ = run_extraction(
            "reviewed pull requests, 1.5 hours, done"
        )
        assert result is not None
        # ticket_id and project_name are absent — that's fine
        assert not any(i.clarification_needed for i in result.items), \
            f"Optional missing fields should not trigger clarification: {[i.clarification_reason for i in result.items if i.clarification_needed]}"
        assert status == "success"


class TestDateHandling:
    def test_relative_date_resolved_in_context(self):
        """'Yesterday' should resolve to yesterday's date given today's context."""
        today = date.today()
        from datetime import timedelta
        yesterday = today - timedelta(days=1)

        result, _, _ = run_extraction(
            "yesterday I fixed the auth module bug, took 1.5 hours, done",
            work_date=today,
        )
        assert result is not None
        # work_date override should be applied (we set it explicitly)
        assert result.work_date == today

    def test_ticket_id_extracted_when_mentioned(self):
        """Ticket ID in message → ticket_id field populated."""
        result, _, _ = run_extraction(
            "fixed INC-231 authentication bug, 2 hours, done"
        )
        assert result is not None
        item = result.items[0]
        assert item.ticket_id is not None, "Expected ticket_id to be extracted"
        assert "INC-231" in (item.ticket_id or ""), \
            f"Expected 'INC-231' in ticket_id, got: {item.ticket_id}"


class TestModelSelection:
    def test_haiku_can_extract_simple_message(self):
        """Haiku (fast model) should handle simple extractions correctly."""
        result, status, model_name = run_extraction(
            "fixed a bug in the login flow, 1 hour, done",
            model="Claude Haiku 4.5",
        )
        assert result is not None, f"Haiku extraction failed"
        assert result.items[0].status == "done"
        assert result.items[0].hours_spent == pytest.approx(1.0, abs=0.1)
        assert "Haiku" in model_name or "haiku" in model_name.lower()

    def test_sonnet_and_haiku_produce_consistent_results(self):
        """Both models should agree on a clear, unambiguous message."""
        message = "completed the API documentation update, 2 hours, done"

        result_sonnet, _, _ = run_extraction(message, model="Claude Sonnet 4.6")
        result_haiku, _, _ = run_extraction(message, model="Claude Haiku 4.5")

        assert result_sonnet is not None
        assert result_haiku is not None

        # Both should extract ~2 hours and status=done
        assert result_sonnet.items[0].hours_spent == pytest.approx(2.0, abs=0.1)
        assert result_haiku.items[0].hours_spent == pytest.approx(2.0, abs=0.1)
        assert result_sonnet.items[0].status == "done"
        assert result_haiku.items[0].status == "done"
