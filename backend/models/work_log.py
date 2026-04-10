"""WorkLog ORM model — one per NL submission."""

import uuid
from datetime import date, datetime

from typing import List

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class WorkLog(Base):
    __tablename__ = "work_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    work_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    raw_message: Mapped[str] = mapped_column(Text, nullable=False)
    extraction_status: Mapped[str] = mapped_column(
        Enum("pending", "success", "failed", "needs_review", name="extraction_status"),
        nullable=False,
        default="pending",
    )
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    parse_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    superseded_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("work_logs.id"), nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="work_logs")  # type: ignore[name-defined]
    work_items: Mapped[List["WorkItem"]] = relationship(
        "WorkItem", back_populates="work_log", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<WorkLog {self.id} user={self.user_id} date={self.work_date} status={self.extraction_status}>"
