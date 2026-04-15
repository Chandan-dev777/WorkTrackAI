"""
Integration tests for the help widget assistant — real LLM calls.

Tests verify:
  1. Response quality: correct keywords for known app questions
  2. Scope enforcement: work-history queries redirected to Chat Assistant page
  3. Off-topic refusal: non-app questions declined politely
  4. Note-saving via chat: LLM emits the save_note JSON action and note is persisted
  5. Role/page context injection: page context surfaces in the answer

Run with:
    pytest -m integration tests/integration/test_assistant_integration.py -v -s
"""

import asyncio
import pytest

from backend.models.user import User
from backend.services.assistant_service import (
    create_note,
    list_notes,
    stream_assistant_response,
)
from backend.services.auth_service import hash_password

pytestmark = pytest.mark.integration


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(db, role: str = "employee") -> User:
    user = User(
        employee_id="AINT-001",
        full_name="Assistant Tester",
        email="assistant_int@test.com",
        hashed_password=hash_password("pass"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


async def _collect(gen) -> tuple[str, list[str]]:
    """Collect all text chunks from stream_assistant_response.

    Returns:
        full_text: concatenated text content
        tool_calls: list of tool_call strings emitted
    """
    full_text = ""
    tool_calls: list[str] = []
    async for chunk in gen:
        # chunk is an SSE line: "data: {...}\n\n"
        import json
        if not chunk.startswith("data: "):
            continue
        raw = chunk[6:].strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if obj.get("done"):
            break
        if "text" in obj:
            full_text += obj["text"]
        if "tool_call" in obj:
            tool_calls.append(obj["tool_call"])
    return full_text, tool_calls


# ── App knowledge quality tests ───────────────────────────────────────────────

class TestAppKnowledgeQuality:
    """Verify the LLM gives correct, relevant answers about WorkTrack AI features."""

    async def test_submission_flow_explanation(self, db):
        """Asking how to submit a work update should describe the NL→preview→confirm flow."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="How do I submit a work update?",
                session_id="int-submit",
                page_context="Submit Work Update",
                user=user,
                db=db,
            )
        )
        assert text, "Expected a non-empty response"
        lower = text.lower()
        # Must mention the input step and the confirm/preview step
        assert any(w in lower for w in ["text", "natural language", "type", "write"]), \
            f"Response doesn't describe input step: {text}"
        assert any(w in lower for w in ["confirm", "preview", "review"]), \
            f"Response doesn't mention confirm/preview step: {text}"

    async def test_confidence_score_explanation(self, db):
        """Asking about confidence score should explain what 0.0–1.0 means."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What does the confidence score column mean on My Dashboard?",
                session_id="int-conf",
                page_context="My Dashboard",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["confidence", "certain", "ai", "extraction", "accurate"]), \
            f"Response doesn't explain confidence score: {text}"
        # Should mention scale or low threshold
        assert any(w in lower for w in ["0", "1", "score", "0.7", "low", "high", "ambig"]), \
            f"Response doesn't explain the scale: {text}"

    async def test_work_categories_listed(self, db):
        """Asking about categories should list the controlled vocabulary."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What work categories are available in WorkTrack AI?",
                session_id="int-cats",
                page_context="Submit Work Update",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        # At least 4 of the 10 categories must appear
        categories = ["project", "ticket", "meeting", "admin", "learning",
                      "support", "documentation", "review", "other"]
        found = [c for c in categories if c in lower]
        assert len(found) >= 4, \
            f"Only found {found} categories in response: {text}"

    async def test_role_permissions_explained(self, db):
        """Asking what managers can see should describe team-level access."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What can managers see that regular employees cannot?",
                session_id="int-roles",
                page_context="",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["team", "dashboard", "employee", "all"]), \
            f"Response doesn't describe manager access: {text}"

    async def test_when_to_contact_admin(self, db):
        """Asking when to contact admin should list valid admin-required scenarios."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="When should I contact my admin?",
                session_id="int-admin",
                page_context="",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["password", "role", "reset", "account", "deactivat", "permission"]), \
            f"Response doesn't describe admin contact scenarios: {text}"

    async def test_status_values_explained(self, db):
        """Asking about status values should describe planned/in_progress/blocked/done."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What are the different status values for a work item?",
                session_id="int-status",
                page_context="My Dashboard",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        statuses = ["planned", "in_progress", "blocked", "done", "in progress"]
        found = [s for s in statuses if s in lower]
        assert len(found) >= 3, \
            f"Only found {found} status values in response: {text}"

    async def test_login_error_guidance(self, db):
        """Asking about a 401 error should give actionable fix advice."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="I keep getting a 401 error when I try to log in. What does it mean?",
                session_id="int-401",
                page_context="Login",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["token", "expired", "log out", "login", "log in", "session"]), \
            f"Response doesn't explain 401: {text}"


# ── Scope enforcement tests ───────────────────────────────────────────────────

class TestScopeEnforcement:
    """Verify the LLM refuses out-of-scope questions and redirects correctly."""

    async def test_work_history_query_redirected(self, db):
        """Work-data questions must redirect to Chat Assistant, not answer directly."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="How many hours did I log last week?",
                session_id="int-scope-1",
                page_context="My Dashboard",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        # Must mention the Chat Assistant page as the right place
        assert any(w in lower for w in ["chat assistant", "chat", "assistant page", "navigation"]), \
            f"Response didn't redirect to Chat Assistant for work-history query: {text}"
        # Must NOT fabricate an hours number
        import re
        hour_numbers = re.findall(r'\b\d+(?:\.\d+)?\s*(?:hours?|hrs?)\b', lower)
        assert not hour_numbers, \
            f"LLM fabricated hours data: {hour_numbers} — full response: {text}"

    async def test_work_items_query_redirected(self, db):
        """Asking to list logged tasks must redirect, not query the DB."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="Show me all the tasks I worked on this week.",
                session_id="int-scope-2",
                page_context="",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["chat assistant", "chat", "assistant page"]), \
            f"Response didn't redirect to Chat Assistant: {text}"

    async def test_off_topic_general_knowledge_declined(self, db):
        """A non-app question (geography) should be politely declined."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What is the capital of France?",
                session_id="int-scope-3",
                page_context="",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        # Should NOT answer "Paris"
        assert "paris" not in lower, \
            f"LLM answered off-topic geography question: {text}"
        # Should decline or redirect
        assert any(w in lower for w in ["only", "worktrack", "can't", "cannot", "help with", "scope"]), \
            f"LLM didn't decline off-topic question: {text}"

    async def test_coding_question_declined(self, db):
        """A general coding question must be declined."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="Can you write me a Python function to sort a list?",
                session_id="int-scope-4",
                page_context="",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        # Should not contain Python code
        assert "def " not in text, \
            f"LLM wrote Python code for an off-topic request: {text}"


# ── Note-saving via natural language ─────────────────────────────────────────

class TestNoteSavingViaChat:
    """Verify the LLM emits save_note JSON that the service parses and persists."""

    async def test_saves_bug_from_chat(self, db):
        """Saying 'save a bug' should create an AssistantNote of type bug."""
        user = _make_user(db)

        text, tool_calls = await _collect(
            stream_assistant_response(
                message="Please save a bug: the date picker on the Submit page defaults to tomorrow instead of today",
                session_id="int-note-1",
                page_context="Submit Work Update",
                user=user,
                db=db,
            )
        )

        # A tool_call chunk should have been emitted
        assert tool_calls, \
            f"No tool_call emitted. Full response: {text}"

        # Note must exist in the DB
        notes = list_notes(db, requesting_user=user)
        assert len(notes) == 1, f"Expected 1 note, found {len(notes)}"
        note = notes[0]
        assert note.type == "bug"
        assert note.user_id == user.id
        assert "date" in note.title.lower() or "date" in note.body.lower(), \
            f"Note doesn't mention 'date': title={note.title!r}, body={note.body!r}"

    async def test_saves_requirement_from_chat(self, db):
        """Saying 'add a requirement' should create an AssistantNote of type requirement."""
        user = _make_user(db)

        text, tool_calls = await _collect(
            stream_assistant_response(
                message="Add a requirement: I want to be able to export my dashboard as a PDF",
                session_id="int-note-2",
                page_context="My Dashboard",
                user=user,
                db=db,
            )
        )

        assert tool_calls, \
            f"No tool_call emitted. Full response: {text}"

        notes = list_notes(db, requesting_user=user)
        assert len(notes) == 1
        note = notes[0]
        assert note.type == "requirement"
        assert any(w in (note.title + note.body).lower() for w in ["export", "pdf", "dashboard"]), \
            f"Note doesn't capture the requirement: {note.title!r} / {note.body!r}"

    async def test_confirmation_message_follows_save(self, db):
        """After saving a note the LLM should send a confirmation sentence."""
        user = _make_user(db)

        text, tool_calls = await _collect(
            stream_assistant_response(
                message="Save a feedback note: the extraction accuracy is excellent",
                session_id="int-note-3",
                page_context="Submit Work Update",
                user=user,
                db=db,
            )
        )

        assert tool_calls, f"No tool_call emitted. Response: {text}"
        assert text.strip(), "Expected a confirmation message after save but got empty text"
        lower = text.lower()
        assert any(w in lower for w in ["saved", "noted", "filed", "recorded", "got it"]), \
            f"No confirmation in response: {text}"


# ── Page context injection ────────────────────────────────────────────────────

class TestPageContextInjection:
    """Verify the LLM uses page_context to give page-specific answers."""

    async def test_dashboard_context_gives_dashboard_specific_answer(self, db):
        """On My Dashboard page, asking about charts should mention dashboard-specific fields."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What am I looking at on this page?",
                session_id="int-ctx-1",
                page_context="My Dashboard",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["dashboard", "chart", "work item", "hours", "category", "table"]), \
            f"Response not specific to My Dashboard: {text}"

    async def test_submit_context_gives_submit_specific_answer(self, db):
        """On Submit page, asking for help should describe the submission workflow."""
        user = _make_user(db)
        text, _ = await _collect(
            stream_assistant_response(
                message="What should I do on this page?",
                session_id="int-ctx-2",
                page_context="Submit Work Update",
                user=user,
                db=db,
            )
        )
        assert text
        lower = text.lower()
        assert any(w in lower for w in ["submit", "update", "text", "type", "work"]), \
            f"Response not specific to Submit page: {text}"
