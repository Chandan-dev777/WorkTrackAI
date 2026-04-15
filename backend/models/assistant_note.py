"""AssistantNote ORM model — requirements, bugs, and feedback filed via the help widget."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class AssistantNote(Base):
    __tablename__ = "assistant_notes"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(
        Enum("bug", "requirement", "feedback", name="note_type"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", "critical", name="note_priority"),
        nullable=False,
        default="medium",
    )
    status: Mapped[str] = mapped_column(
        Enum(
            "open",
            "acknowledged",
            "in_progress",
            "resolved",
            "wont_fix",
            name="note_status",
        ),
        nullable=False,
        default="open",
    )
    affected_page: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="assistant_notes")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<AssistantNote {self.id} type={self.type} status={self.status}>"
