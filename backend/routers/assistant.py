"""Assistant router — help widget chat (SSE) and note CRUD."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.assistant import ChatRequest, NoteCreate, NoteResponse, NoteUpdate
from backend.services.assistant_service import (
    NoteAccessError,
    NoteNotFoundError,
    create_note,
    delete_note,
    list_notes,
    stream_assistant_response,
    update_note,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assistant", tags=["assistant"])


# ── SSE chat stream ───────────────────────────────────────────────────────────

@router.post("/chat")
async def chat_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Stream help-widget responses as Server-Sent Events.

    Accepts conversation history so the LLM can answer follow-up questions.
    """
    return StreamingResponse(
        stream_assistant_response(
            message=payload.message,
            session_id=payload.session_id or "default",
            page_context=payload.page_context,
            user=current_user,
            db=db,
            history=[h.model_dump() for h in payload.history],
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Note CRUD ─────────────────────────────────────────────────────────────────

@router.post("/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note_endpoint(
    payload: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteResponse:
    note = create_note(
        db,
        current_user.id,
        type=payload.type,
        title=payload.title,
        body=payload.body,
        priority=payload.priority,
        affected_page=payload.affected_page,
    )
    return NoteResponse.model_validate(note)


@router.get("/notes", response_model=list[NoteResponse])
def list_notes_endpoint(
    type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[NoteResponse]:
    notes = list_notes(
        db,
        requesting_user=current_user,
        type_filter=type,
        status_filter=status,
    )
    result = []
    for note in notes:
        r = NoteResponse.model_validate(note)
        r.user_name = note.user.full_name if note.user else None
        result.append(r)
    return result


@router.patch("/notes/{note_id}", response_model=NoteResponse)
def update_note_endpoint(
    note_id: str,
    payload: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NoteResponse:
    try:
        note = update_note(
            db,
            note_id,
            current_user.id,
            current_user.role,
            title=payload.title,
            body=payload.body,
            priority=payload.priority,
            status=payload.status,
            affected_page=payload.affected_page,
        )
    except NoteNotFoundError:
        raise HTTPException(status_code=404, detail="Note not found")
    except NoteAccessError:
        raise HTTPException(status_code=403, detail="Not permitted to update this note")
    return NoteResponse.model_validate(note)


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note_endpoint(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_note(db, note_id, current_user.id, current_user.role)
    except NoteNotFoundError:
        raise HTTPException(status_code=404, detail="Note not found")
    except NoteAccessError:
        raise HTTPException(status_code=403, detail="Not permitted to delete this note")
