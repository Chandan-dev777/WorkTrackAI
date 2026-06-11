"""Pydantic schemas for the assistant widget endpoints."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

NoteType = Literal["bug", "requirement", "feedback"]
NotePriority = Literal["low", "medium", "high", "critical"]
NoteStatus = Literal["open", "acknowledged", "in_progress", "resolved", "wont_fix"]


class NoteCreate(BaseModel):
    type: NoteType
    title: str
    body: str
    priority: Optional[NotePriority] = "medium"
    affected_page: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title cannot be empty")
        return v.strip()

    @field_validator("body")
    @classmethod
    def body_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("body cannot be empty")
        return v.strip()


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    priority: Optional[NotePriority] = None
    status: Optional[NoteStatus] = None
    affected_page: Optional[str] = None


class NoteResponse(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    type: NoteType
    title: str
    body: str
    priority: NotePriority
    status: NoteStatus
    affected_page: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Chat streaming ─────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    page_context: Optional[str] = None
    # Previous turns — enables follow-up questions. Max 10 entries enforced in service.
    history: list[HistoryEntry] = []

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message cannot be empty")
        return v.strip()
