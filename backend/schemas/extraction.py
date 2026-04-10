"""
Pydantic schemas for LLM extraction output.

These form the contract between the extraction chain and the rest of the system.
The LLM is instructed to return JSON matching ExtractionResult exactly.
"""

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, field_validator

WorkCategory = Literal[
    "project",
    "ticket",
    "polaris_classification",
    "admin",
    "meeting",
    "learning",
    "support",
    "documentation",
    "review",
    "other",
]

StatusType = Literal["planned", "in_progress", "blocked", "done"]
PriorityType = Literal["low", "medium", "high"]


class WorkItemExtracted(BaseModel):
    task_description: str
    work_category: WorkCategory
    hours_spent: Optional[float] = None          # null if not mentioned
    status: Optional[StatusType] = None          # null if ambiguous
    priority: Optional[PriorityType] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    tags: Optional[List[str]] = None
    links: Optional[List[str]] = None
    project_name: Optional[str] = None
    ticket_id: Optional[str] = None
    confidence_score: Optional[float] = None     # 0.0–1.0 LLM self-reported
    clarification_needed: bool = False
    clarification_reason: Optional[str] = None  # describes what is ambiguous

    @field_validator("hours_spent")
    @classmethod
    def hours_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("hours_spent must be non-negative")
        return v

    @field_validator("confidence_score")
    @classmethod
    def confidence_in_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("confidence_score must be between 0.0 and 1.0")
        return v


class ExtractionResult(BaseModel):
    work_date: date                              # inferred or defaulted to today
    items: List[WorkItemExtracted]
    total_hours_warning: bool = False            # true if sum of hours_spent > 12

    @field_validator("items")
    @classmethod
    def at_least_one_item(cls, v: List[WorkItemExtracted]) -> List[WorkItemExtracted]:
        if not v:
            raise ValueError("Extraction must produce at least one work item")
        return v
