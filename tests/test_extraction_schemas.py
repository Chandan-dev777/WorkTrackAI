"""Unit tests for extraction Pydantic schemas."""

import pytest
from datetime import date
from pydantic import ValidationError

from backend.schemas.extraction import (
    ExtractionResult,
    WorkItemExtracted,
)


class TestWorkItemExtracted:
    def test_minimal_valid(self):
        item = WorkItemExtracted(
            task_description="Fixed login bug",
            work_category="ticket",
        )
        assert item.task_description == "Fixed login bug"
        assert item.work_category == "ticket"
        assert item.hours_spent is None
        assert item.clarification_needed is False

    def test_all_fields(self):
        item = WorkItemExtracted(
            task_description="Reviewed PR for auth module",
            work_category="review",
            hours_spent=1.5,
            status="done",
            priority="high",
            blockers=None,
            next_steps="Merge to main",
            tags=["sprint-12", "auth"],
            links=["https://github.com/pr/42"],
            project_name="Project Apollo",
            ticket_id="INC-231",
            confidence_score=0.95,
            clarification_needed=False,
        )
        assert item.hours_spent == 1.5
        assert item.status == "done"
        assert item.tags == ["sprint-12", "auth"]

    def test_negative_hours_raises(self):
        with pytest.raises(ValidationError):
            WorkItemExtracted(
                task_description="Test",
                work_category="other",
                hours_spent=-1.0,
            )

    def test_confidence_out_of_range_raises(self):
        with pytest.raises(ValidationError):
            WorkItemExtracted(
                task_description="Test",
                work_category="other",
                confidence_score=1.5,
            )

    def test_invalid_work_category_raises(self):
        with pytest.raises(ValidationError):
            WorkItemExtracted(
                task_description="Test",
                work_category="invalid_category",
            )

    def test_invalid_status_raises(self):
        with pytest.raises(ValidationError):
            WorkItemExtracted(
                task_description="Test",
                work_category="other",
                status="ongoing",   # must be normalised before this point
            )

    def test_clarification_needed_with_reason(self):
        item = WorkItemExtracted(
            task_description="Worked on something",
            work_category="project",
            clarification_needed=True,
            clarification_reason="Hours not mentioned",
        )
        assert item.clarification_needed is True
        assert "Hours" in item.clarification_reason

    def test_all_valid_categories(self):
        categories = [
            "project", "ticket", "polaris_classification", "admin",
            "meeting", "learning", "support", "documentation", "review", "other",
        ]
        for cat in categories:
            item = WorkItemExtracted(task_description="x", work_category=cat)
            assert item.work_category == cat

    def test_all_valid_statuses(self):
        for s in ("planned", "in_progress", "blocked", "done"):
            item = WorkItemExtracted(
                task_description="x", work_category="other", status=s
            )
            assert item.status == s


class TestExtractionResult:
    def test_valid_result(self):
        result = ExtractionResult(
            work_date=date.today(),
            items=[
                WorkItemExtracted(task_description="Task A", work_category="project"),
            ],
        )
        assert len(result.items) == 1
        assert result.total_hours_warning is False

    def test_empty_items_raises(self):
        with pytest.raises(ValidationError):
            ExtractionResult(work_date=date.today(), items=[])

    def test_total_hours_warning_flag(self):
        result = ExtractionResult(
            work_date=date.today(),
            items=[WorkItemExtracted(task_description="x", work_category="other")],
            total_hours_warning=True,
        )
        assert result.total_hours_warning is True

    def test_multiple_items(self):
        result = ExtractionResult(
            work_date=date.today(),
            items=[
                WorkItemExtracted(task_description="A", work_category="project"),
                WorkItemExtracted(task_description="B", work_category="meeting"),
                WorkItemExtracted(task_description="C", work_category="review"),
            ],
        )
        assert len(result.items) == 3
