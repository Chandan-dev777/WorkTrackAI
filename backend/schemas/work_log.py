"""Pydantic schemas for WorkLog and WorkItem API I/O."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from backend.schemas.extraction import WorkItemExtracted


# ── Submit / Confirm ──────────────────────────────────────────────────────────

class SubmitUpdateRequest(BaseModel):
    raw_message: str
    work_date: Optional[date] = None   # defaults to today server-side if omitted


class ConfirmUpdateRequest(BaseModel):
    """
    Sent by the user after reviewing the extraction preview.
    `items` contains the (possibly user-edited) extracted work items.
    """
    items: List[WorkItemExtracted]
    work_date: date


# ── Response schemas ──────────────────────────────────────────────────────────

class WorkItemResponse(BaseModel):
    id: str
    work_log_id: str
    employee_id: str
    work_date: date
    task_description: str
    work_category: str
    hours_spent: Optional[float]
    status: Optional[str]
    priority: Optional[str]
    blockers: Optional[str]
    next_steps: Optional[str]
    tags: Optional[List[str]]
    links: Optional[List[str]]
    project_name: Optional[str]
    ticket_id: Optional[str]
    confidence_score: Optional[float]
    needs_review: bool
    clarification_needed: bool
    clarification_reason: Optional[str]
    is_user_corrected: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkLogResponse(BaseModel):
    id: str
    user_id: str
    work_date: date
    submitted_at: datetime
    raw_message: str
    extraction_status: str
    model_name: Optional[str]
    is_deleted: bool
    work_items: Optional[List[WorkItemResponse]] = []

    model_config = {"from_attributes": True}


class SubmitUpdateResponse(BaseModel):
    """Returned immediately after submit — extraction preview, not yet persisted."""
    work_log_id: str
    work_date: date
    extraction_status: str
    items: List[WorkItemExtracted]
    total_hours_warning: bool
    has_clarification_needed: bool
