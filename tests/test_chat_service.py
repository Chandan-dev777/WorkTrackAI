"""Tests for run_chat_query — agent with mocked LLM."""

import json
from unittest.mock import MagicMock, patch

import pytest

from backend.models.user import User
from backend.services.chat_service import get_chat_history, run_chat_query


def _make_user(db, role="employee"):
    user = User(
        employee_id="EMP-CS1",
        full_name="Chat Svc Test",
        email="chatsvc@x.com",
        hashed_password="h",
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _mock_agent_result(answer: str, tool_names: list[str]):
    """Build a fake agent result dict with ToolMessages for each named tool."""
    from langchain_core.messages import AIMessage, ToolMessage

    messages = []
    for name in tool_names:
        tm = ToolMessage(content=json.dumps([]), tool_call_id="fake", name=name)
        messages.append(tm)
    messages.append(AIMessage(content=answer))
    return {"messages": messages}


class TestRunChatQuery:
    def test_returns_answer_and_session_id(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("You logged 5 hours.", ["sql_query"])
            mock_agent_factory.return_value = mock_agent

            answer, source, sources, session_id = run_chat_query(
                question="How many hours did I log this week?",
                user_id=user.id,
                user_role=user.role,
                db=db,
            )

        assert "hours" in answer.lower()
        assert source == "sql"
        assert session_id is not None

    def test_query_source_vector_when_only_vector_search_used(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result(
                "You were working on the API module.", ["vector_search"]
            )
            mock_agent_factory.return_value = mock_agent

            _, source, _, _ = run_chat_query(
                "What was I working on last week?", user.id, user.role, db
            )

        assert source == "vector"

    def test_query_source_hybrid_when_both_tools_used(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result(
                "Complex answer.", ["date_resolver", "sql_query", "vector_search"]
            )
            mock_agent_factory.return_value = mock_agent

            _, source, _, _ = run_chat_query(
                "Summarise my week.", user.id, user.role, db
            )

        assert source == "hybrid"

    def test_date_resolver_alone_defaults_to_sql_source(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result(
                "Last week was Mon–Sun.", ["date_resolver"]
            )
            mock_agent_factory.return_value = mock_agent

            _, source, _, _ = run_chat_query("When was last week?", user.id, user.role, db)

        assert source == "sql"  # date_resolver alone → default sql

    def test_session_id_is_reused_when_provided(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("OK.", [])
            mock_agent_factory.return_value = mock_agent

            _, _, _, returned_session = run_chat_query(
                "hi", user.id, user.role, db, session_id="my-fixed-session"
            )

        assert returned_session == "my-fixed-session"

    def test_llm_failure_returns_graceful_error_message(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.side_effect = Exception("Network timeout")
            mock_agent_factory.return_value = mock_agent

            answer, source, sources, session_id = run_chat_query(
                "Any question.", user.id, user.role, db
            )

        assert "sorry" in answer.lower() or "technical" in answer.lower()
        assert session_id is not None

    def test_chat_history_is_persisted(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("Answer stored.", ["sql_query"])
            mock_agent_factory.return_value = mock_agent

            _, _, _, session_id = run_chat_query(
                "Test question.", user.id, user.role, db, session_id="hist-session"
            )

        history = get_chat_history(db, user.id, session_id="hist-session")
        assert len(history) == 1
        assert history[0].question == "Test question."
        assert history[0].answer == "Answer stored."
        assert history[0].query_source == "sql"


class TestGetChatHistory:
    def test_returns_history_for_user(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("ans", [])
            mock_agent_factory.return_value = mock_agent

            for i in range(3):
                run_chat_query(f"Question {i}", user.id, user.role, db, session_id="sess-1")

        history = get_chat_history(db, user.id)
        assert len(history) == 3

    def test_filters_by_session_id(self, db):
        user = _make_user(db)
        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("x", [])
            mock_agent_factory.return_value = mock_agent

            run_chat_query("Q1", user.id, user.role, db, session_id="sess-A")
            run_chat_query("Q2", user.id, user.role, db, session_id="sess-B")

        sess_a = get_chat_history(db, user.id, session_id="sess-A")
        assert len(sess_a) == 1
        assert sess_a[0].question == "Q1"

    def test_does_not_return_other_users_history(self, db):
        user_a = _make_user(db)
        user_b = User(employee_id="EMP-B", full_name="B", email="b@x.com",
                      hashed_password="h", role="employee")
        db.add(user_b)
        db.commit()

        with patch("backend.services.chat_service.create_react_agent") as mock_agent_factory:
            mock_agent = MagicMock()
            mock_agent.invoke.return_value = _mock_agent_result("ans", [])
            mock_agent_factory.return_value = mock_agent

            run_chat_query("A's question", user_a.id, user_a.role, db)

        assert get_chat_history(db, user_b.id) == []
