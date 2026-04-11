"""Pydantic schemas for WorkItem API I/O."""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

WorkCategory = Literal[
    "project", "ticket", "polaris_classification", "admin",
    "meeting", "learning", "support", "documentation", "review", "other",
]
StatusType = Literal["planned", "in_progress", "blocked", "done"]
PriorityType = Literal["low", "medium", "high"]


class WorkItemUpdate(BaseModel):
    """Fields the user may edit on a confirmed work item."""
    task_description: Optional[str] = None
    work_category: Optional[WorkCategory] = None
    hours_spent: Optional[float] = None
    status: Optional[StatusType] = None
    priority: Optional[PriorityType] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    project_name: Optional[str] = None
    ticket_id: Optional[str] = None

    @field_validator("hours_spent")
    @classmethod
    def hours_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("hours_spent must be non-negative")
        return v


class WorkItemResponse(BaseModel):
    id: str
    work_log_id: str
    employee_id: str
    work_date: date
    task_description: str
    work_category: str
    hours_spent: Optional[float] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    tags: Optional[list] = None
    links: Optional[list] = None
    project_name: Optional[str] = None
    ticket_id: Optional[str] = None
    confidence_score: Optional[float] = None
    needs_review: bool = False
    clarification_needed: bool = False
    clarification_reason: Optional[str] = None
    is_user_corrected: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
