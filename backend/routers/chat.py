"""
Chat router.

POST /chat/query    — ask the LangGraph agent a question
GET  /chat/history  — retrieve past chat turns (own history)
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.chat import ChatHistoryItem, ChatQueryRequest, ChatResponse
from backend.services.chat_service import get_chat_history, run_chat_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/query", response_model=ChatResponse)
def chat_query(
    payload: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Send a question to the RAG agent. Returns answer + source references."""
    answer, query_source, sources, session_id = run_chat_query(
        question=payload.question,
        user_id=current_user.id,
        user_role=current_user.role,
        db=db,
        session_id=payload.session_id,
        team_name=current_user.team_name,
    )
    return ChatResponse(
        answer=answer,
        query_source=query_source,
        session_id=session_id,
        sources=sources,
    )


@router.get("/history", response_model=list[ChatHistoryItem])
def chat_history(
    session_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ChatHistoryItem]:
    """Retrieve past chat turns for the current user."""
    records = get_chat_history(db, current_user.id, session_id, limit)
    return [ChatHistoryItem.model_validate(r) for r in records]
