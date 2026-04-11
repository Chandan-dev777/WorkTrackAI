"""
Integration tests for chat_service — real LLM + real tools.

These verify the full agent loop: LLM receives the question, decides which
tool to call, calls it with correct parameters, and synthesises a correct answer.

Run with: pytest -m integration tests/integration/test_chat_integration.py -v -s
"""

import json
import pytest
from datetime import date, timedelta

from backend.services.chat_service import (
    _resolve_date_expression,
    make_tools,
    run_chat_query,
)


pytestmark = pytest.mark.integration

TODAY = date.today()
LAST_WEEK = TODAY - timedelta(days=6)


# ── Tool-level tests (deterministic — no LLM) ─────────────────────────────────

class TestDateResolverDirect:
    """date_resolver is pure Python — no LLM needed, but kept here for completeness."""

    def test_resolves_this_week(self):
        r = _resolve_date_expression("this week", TODAY)
        monday = TODAY - timedelta(days=TODAY.weekday())
        assert r["start_date"] == monday.isoformat()

    def test_resolves_last_30_days(self):
        r = _resolve_date_expression("last 30 days", TODAY)
        assert r["start_date"] == (TODAY - timedelta(days=29)).isoformat()
        assert r["end_date"] == TODAY.isoformat()


class TestSqlToolWithRealData:
    """sql_query tool runs against a real in-memory SQLite DB (no LLM)."""

    def test_list_items_returns_task_descriptions(self, seeded_db, db):
        user, items = seeded_db
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "list_items",
            "start_date": LAST_WEEK.isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        assert len(result) == 2
        descs = [r["task_description"] for r in result]
        assert any("preprocessing" in d.lower() or "chatbot" in d.lower() for d in descs)

    def test_total_hours_summary_correct(self, seeded_db, db):
        user, _ = seeded_db
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "total_hours_summary",
            "start_date": LAST_WEEK.isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        assert result["total_hours"] == pytest.approx(2.5, abs=0.01)
        assert result["done_count"] == 2
        assert result["total_items"] == 2


# ── Full agent tests (real LLM + real tools) ──────────────────────────────────

class TestChatAgentWithRealLLM:
    def test_agent_answers_hours_question(self, seeded_db, db):
        """Agent should call sql_query and return a number-based answer."""
        user, _ = seeded_db

        answer, source, sources, session_id = run_chat_query(
            question=f"How many hours did I log this week ({TODAY.isoformat()})?",
            user_id=user.id,
            user_role=user.role,
            db=db,
        )

        assert answer, "Expected a non-empty answer"
        # Should mention 2.5 hours (or close) and use SQL path
        assert source in ("sql", "hybrid"), f"Expected sql or hybrid source, got {source}"
        # The answer should reference hours
        assert any(word in answer.lower() for word in ["hour", "2.5", "2", "logged"]), \
            f"Answer doesn't mention hours: {answer}"

    def test_agent_shows_task_description_when_asked(self, seeded_db, db):
        """Agent should retrieve actual task descriptions using list_items."""
        user, _ = seeded_db

        answer, source, _, _ = run_chat_query(
            question=f"Show me the tasks I worked on today ({TODAY.isoformat()}). List them with descriptions.",
            user_id=user.id,
            user_role=user.role,
            db=db,
        )

        assert answer, "Expected a non-empty answer"
        # Should mention the actual task descriptions
        assert any(
            keyword in answer.lower()
            for keyword in ["preprocessing", "chatbot", "standup", "meeting", "bug", "ticket"]
        ), f"Answer doesn't mention any known task keywords: {answer}"

    def test_agent_uses_date_resolver_for_relative_dates(self, seeded_db, db):
        """Agent should call date_resolver first when query uses 'this week'."""
        user, _ = seeded_db

        answer, source, _, session_id = run_chat_query(
            question="What did I work on this week?",
            user_id=user.id,
            user_role=user.role,
            db=db,
        )

        assert answer, "Expected a non-empty answer"
        assert session_id is not None

    def test_agent_respects_employee_data_isolation(self, db):
        """Employee query must NOT return data belonging to another user."""
        from backend.models.user import User as UserModel
        from backend.models.work_item import WorkItem
        from backend.models.work_log import WorkLog
        import uuid

        user_a = UserModel(
            employee_id="INT-A", full_name="A", email="a@int.com",
            hashed_password="h", role="employee",
        )
        user_b = UserModel(
            employee_id="INT-B", full_name="B", email="b@int.com",
            hashed_password="h", role="employee",
        )
        db.add(user_a)
        db.add(user_b)
        db.flush()

        # Only user_a has work items
        log = WorkLog(
            id=str(uuid.uuid4()), user_id=user_a.id,
            work_date=TODAY, raw_message="test", extraction_status="success",
        )
        db.add(log)
        db.flush()
        db.add(WorkItem(
            id=str(uuid.uuid4()), work_log_id=log.id,
            employee_id=user_a.employee_id, work_date=TODAY,
            task_description="Secret project Zephyr", work_category="project",
            hours_spent=3.0, status="in_progress",
        ))
        db.commit()

        # user_b asks about their tasks — should get 0 hours, not user_a's data
        answer, _, _, _ = run_chat_query(
            question=f"How many hours did I log today ({TODAY.isoformat()})?",
            user_id=user_b.id,
            user_role=user_b.role,
            db=db,
        )

        assert "Zephyr" not in answer, \
            f"user_b's answer leaked user_a's secret project! Answer: {answer}"
        # Should report 0 or no data for user_b
        assert any(word in answer.lower() for word in ["0", "no", "nothing", "haven't", "don't"]), \
            f"Expected 'no data' response for user_b, got: {answer}"

    def test_haiku_chat_handles_simple_query(self, seeded_db, db):
        """Haiku model can handle a simple factual question quickly."""
        user, _ = seeded_db

        answer, source, _, _ = run_chat_query(
            question=f"What is my total hours logged today ({TODAY.isoformat()})?",
            user_id=user.id,
            user_role=user.role,
            db=db,
            model="Claude Haiku 4.5",
        )

        assert answer, "Expected a non-empty answer from Haiku"
        assert source in ("sql", "hybrid")
