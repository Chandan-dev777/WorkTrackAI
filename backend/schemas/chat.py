"""Pydantic schemas for chat API I/O."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ChatQueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None  # if None, a new session UUID is generated


class SourceReference(BaseModel):
    work_item_id: str
    work_date: str
    task_description: str
    work_category: str
    employee_id: str


class ChatResponse(BaseModel):
    answer: str
    query_source: str          # "sql" | "vector" | "hybrid"
    session_id: str
    sources: list[SourceReference] = []


class ChatHistoryItem(BaseModel):
    id: str
    question: str
    answer: str
    query_source: Optional[str] = None
    session_id: str
    created_at: datetime

    model_config = {"from_attributes": True}
