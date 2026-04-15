"""Assistant service — note CRUD and LLM streaming for the help widget.

Scope: app-specific help only. Work-data queries belong to chat_service.
LLM: defaults to Claude Haiku 4.5 (fast, cheap for FAQ-style responses).
"""

import json
import logging
import uuid
from typing import AsyncGenerator, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from sqlalchemy.orm import Session

from backend.config import get_llm, settings
from backend.models.assistant_note import AssistantNote
from backend.models.user import User
from backend.prompts.assistant_prompt import ASSISTANT_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# ── Custom exceptions ─────────────────────────────────────────────────────────


class NoteNotFoundError(Exception):
    pass


class NoteAccessError(Exception):
    pass


# ── Role helper ───────────────────────────────────────────────────────────────

def _can_manage(requesting_user_id: str, requesting_role: str, note: AssistantNote) -> bool:
    """Return True if the requesting user may update/delete this note."""
    if requesting_role in ("manager", "admin"):
        return True
    return note.user_id == requesting_user_id


# ── Note CRUD ─────────────────────────────────────────────────────────────────

def create_note(
    db: Session,
    user_id: str,
    *,
    type: str,
    title: str,
    body: str,
    priority: Optional[str] = None,
    affected_page: Optional[str] = None,
) -> AssistantNote:
    note = AssistantNote(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        priority=priority or "medium",
        status="open",
        affected_page=affected_page,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def list_notes(
    db: Session,
    *,
    requesting_user: User,
    type_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> list[AssistantNote]:
    query = db.query(AssistantNote)

    # Role-based visibility
    if requesting_user.role == "employee":
        query = query.filter(AssistantNote.user_id == requesting_user.id)
    # managers and admins see all notes

    if type_filter:
        query = query.filter(AssistantNote.type == type_filter)
    if status_filter:
        query = query.filter(AssistantNote.status == status_filter)

    return query.order_by(AssistantNote.created_at.desc()).all()


def update_note(
    db: Session,
    note_id: str,
    requesting_user_id: str,
    requesting_role: str,
    *,
    title: Optional[str] = None,
    body: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    affected_page: Optional[str] = None,
) -> AssistantNote:
    note = db.query(AssistantNote).filter(AssistantNote.id == note_id).first()
    if note is None:
        raise NoteNotFoundError(f"Note {note_id} not found")
    if not _can_manage(requesting_user_id, requesting_role, note):
        raise NoteAccessError("You do not have permission to update this note")

    if title is not None:
        note.title = title
    if body is not None:
        note.body = body
    if priority is not None:
        note.priority = priority
    if status is not None:
        note.status = status
    if affected_page is not None:
        note.affected_page = affected_page

    db.commit()
    db.refresh(note)
    return note


def delete_note(
    db: Session,
    note_id: str,
    requesting_user_id: str,
    requesting_role: str,
) -> None:
    note = db.query(AssistantNote).filter(AssistantNote.id == note_id).first()
    if note is None:
        raise NoteNotFoundError(f"Note {note_id} not found")
    if not _can_manage(requesting_user_id, requesting_role, note):
        raise NoteAccessError("You do not have permission to delete this note")

    db.delete(note)
    db.commit()


# ── LLM streaming ─────────────────────────────────────────────────────────────

def _build_user_context(user: User, page_context: Optional[str]) -> str:
    parts = [
        f"User: {user.full_name} (role: {user.role}, employee_id: {user.employee_id})",
    ]
    if page_context:
        parts.append(f"Currently viewing: {page_context}")
    return "\n".join(parts)


def _build_tool_instructions(db: Session, user: User) -> str:
    """Tell the LLM which note-saving phrases to recognise and respond to."""
    return (
        "\n\n## SAVING NOTES\n"
        "If the user says something like 'save a bug', 'file a requirement', or 'add feedback', "
        "you must reply with a JSON block on its own line in this exact format:\n"
        '{"action": "save_note", "type": "<bug|requirement|feedback>", '
        '"title": "<short title>", "body": "<full description>", '
        '"priority": "<low|medium|high|critical>", "affected_page": "<page or null>"}\n'
        "Then, on the next line, write a human-readable confirmation like:\n"
        "\"Got it! I've saved that bug report. You can view it in the Notes tab.\"\n"
        "Do NOT invent note IDs — the system assigns them after parsing your JSON."
    )


async def stream_assistant_response(
    message: str,
    session_id: str,
    page_context: Optional[str],
    user: User,
    db: Session,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream SSE chunks from the LLM.

    Chunk format:
      data: {"text": "..."}\n\n          — token text
      data: {"tool_call": "..."}\n\n     — human-readable tool result
      data: {"done": true}\n\n           — end of stream
    """
    llm = get_llm(settings.LLM_MODEL_ASSISTANT)

    system_content = (
        ASSISTANT_SYSTEM_PROMPT
        + "\n\n## CURRENT SESSION\n"
        + _build_user_context(user, page_context)
        + _build_tool_instructions(db, user)
    )

    # Build message list: system + last 10 history turns + current message
    messages = [SystemMessage(content=system_content)]
    for h in (history or [])[-10:]:
        if h.get("role") == "user":
            messages.append(HumanMessage(content=h["content"]))
        else:
            messages.append(AIMessage(content=h["content"]))
    messages.append(HumanMessage(content=message))

    # The enterprise proxy does not support true token streaming (it must buffer
    # the full response to authorise it before forwarding).  We use ainvoke to
    # get the complete response in one call, then emit it as a single SSE text
    # chunk followed by done — preserving the SSE protocol the frontend expects.
    try:
        response = await llm.ainvoke(messages)
        full_text: str = response.content if hasattr(response, "content") else str(response)

        # Detect and execute any embedded save_note action block
        if '{"action": "save_note"' in full_text:
            try:
                start = full_text.index('{"action": "save_note"')
                # Find the matching closing brace
                depth, end = 0, start
                for i, ch in enumerate(full_text[start:], start):
                    if ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break

                action = json.loads(full_text[start:end])
                if action.get("action") == "save_note":
                    saved = create_note(
                        db,
                        user.id,
                        type=action.get("type", "feedback"),
                        title=action.get("title", "Untitled"),
                        body=action.get("body", ""),
                        priority=action.get("priority"),
                        affected_page=action.get("affected_page"),
                    )
                    tool_msg = f"Saved {saved.type} #{saved.id[:8]}: {saved.title}"
                    yield f"data: {json.dumps({'tool_call': tool_msg})}\n\n"
                    logger.info("Widget saved note %s for user %s", saved.id, user.id)

                    # Remove the JSON block from the text before sending
                    full_text = (full_text[:start] + full_text[end:]).strip()
            except (ValueError, KeyError, json.JSONDecodeError) as parse_err:
                logger.warning("save_note parse error: %s", parse_err)

        if full_text:
            yield f"data: {json.dumps({'text': full_text})}\n\n"

    except Exception as exc:
        logger.error("Assistant LLM error: %s", exc)
        err_msg = (
            "I'm sorry, I'm having a technical issue right now. "
            "Please try again in a moment."
        )
        yield f"data: {json.dumps({'text': err_msg})}\n\n"

    yield 'data: {"done": true}\n\n'
