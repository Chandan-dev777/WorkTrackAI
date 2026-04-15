"""User ORM model."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    employee_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("employee", "manager", "admin", name="user_role"),
        nullable=False,
        default="employee",
    )
    team_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    manager_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # Relationships
    work_logs: Mapped[list] = relationship("WorkLog", back_populates="user")
    chat_histories: Mapped[list] = relationship("ChatHistory", back_populates="user")
    assistant_notes: Mapped[list] = relationship("AssistantNote", back_populates="user")
    direct_reports: Mapped[list] = relationship(
        "User", foreign_keys=[manager_id], primaryjoin="User.manager_id == User.id"
    )

    def __repr__(self) -> str:
        return f"<User {self.employee_id} ({self.role})>"
