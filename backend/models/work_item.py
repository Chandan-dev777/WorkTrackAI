"""WorkItem ORM model — one per extracted task within a WorkLog."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class WorkItem(Base):
    __tablename__ = "work_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    work_log_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("work_logs.id"), nullable=False
    )
    employee_id: Mapped[str] = mapped_column(String(50), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    task_description: Mapped[str] = mapped_column(Text, nullable=False)
    work_category: Mapped[str] = mapped_column(
        Enum(
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
            name="work_category",
        ),
        nullable=False,
        default="other",
    )
    hours_spent: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str | None] = mapped_column(
        Enum("planned", "in_progress", "blocked", "done", name="item_status"),
        nullable=True,
    )
    priority: Mapped[str | None] = mapped_column(
        Enum("low", "medium", "high", name="priority_level"),
        nullable=True,
    )
    blockers: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_steps: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    links: Mapped[list | None] = mapped_column(JSON, nullable=True)
    project_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    ticket_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    needs_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    clarification_needed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    clarification_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_user_corrected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Task continuation — links multi-day instances of the same conceptual work
    logical_task_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    continuation_of: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("work_items.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    work_log: Mapped["WorkLog"] = relationship("WorkLog", back_populates="work_items")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<WorkItem {self.id} cat={self.work_category} status={self.status}>"
