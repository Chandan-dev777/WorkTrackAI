"""Admin router — admin-only endpoints."""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.models.work_log import WorkLog
from backend.routers.auth import require_role
from backend.seed_data import seed
from backend.services.chroma_service import reindex_from_sqlite

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

_admin_only = require_role("admin")


# ── GET /admin/users ──────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return all registered users (admin only)."""
    users = db.query(User).order_by(User.full_name).all()
    return [
        {
            "id": u.id,
            "employee_id": u.employee_id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "team_name": u.team_name,
            "department": u.department,
            "is_active": u.is_active,
        }
        for u in users
    ]


# ── GET /admin/extraction-errors ─────────────────────────────────────────────

@router.get("/extraction-errors")
def extraction_errors(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List work logs with failed or needs_review extraction status (admin only)."""
    logs = (
        db.query(WorkLog)
        .filter(
            WorkLog.extraction_status.in_(["failed", "needs_review"]),
            WorkLog.is_deleted == False,  # noqa: E712
        )
        .order_by(WorkLog.submitted_at.desc())
        .limit(200)
        .all()
    )

    # Look up employee_id for each log
    user_map: dict[str, str] = {}
    for log in logs:
        if log.user_id not in user_map:
            user = db.query(User).filter(User.id == log.user_id).first()
            user_map[log.user_id] = user.employee_id if user else "unknown"

    return [
        {
            "id": log.id,
            "employee_id": user_map.get(log.user_id, "unknown"),
            "work_date": log.work_date.isoformat() if log.work_date else None,
            "extraction_status": log.extraction_status,
            "raw_message": log.raw_message,
            "model_name": log.model_name,
            "submitted_at": log.submitted_at.isoformat() if log.submitted_at else None,
        }
        for log in logs
    ]


# ── POST /admin/reindex ───────────────────────────────────────────────────────

@router.post("/reindex")
def trigger_reindex(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Rebuild ChromaDB index from SQLite (admin only)."""
    logger.info("Admin reindex triggered by %s", current_user.employee_id)
    indexed = reindex_from_sqlite(db)
    return {"indexed": indexed, "message": f"Reindex complete — {indexed} items indexed."}


# ── PUT /admin/users/{user_id} ───────────────────────────────────────────────

class UserUpdateRequest(BaseModel):
    role: Optional[Literal["employee", "manager", "admin"]] = None
    is_active: Optional[bool] = None
    team_name: Optional[str] = None
    department: Optional[str] = None


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Update a user's role, active status, team, or department (admin only).

    An admin cannot change their own role or deactivate themselves.
    """
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Self-protection: admin cannot lock themselves out
    if target.id == current_user.id:
        if payload.role is not None and payload.role != current_user.role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot change their own role",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot deactivate their own account",
            )

    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.team_name is not None:
        target.team_name = payload.team_name or None
    if payload.department is not None:
        target.department = payload.department or None

    db.commit()
    db.refresh(target)
    logger.info(
        "Admin %s updated user %s: role=%s is_active=%s",
        current_user.employee_id, target.employee_id, target.role, target.is_active,
    )
    return {
        "id": target.id,
        "employee_id": target.employee_id,
        "full_name": target.full_name,
        "email": target.email,
        "role": target.role,
        "team_name": target.team_name,
        "department": target.department,
        "is_active": target.is_active,
    }


# ── POST /admin/seed-dummy-data ───────────────────────────────────────────────

@router.post("/seed-dummy-data")
def seed_dummy_data(
    current_user: User = Depends(_admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Seed the database with dummy employees and work logs (admin only)."""
    logger.info("Admin seed triggered by %s", current_user.employee_id)
    seed(db)
    return {"message": "Seed complete (skipped if data already exists)."}
