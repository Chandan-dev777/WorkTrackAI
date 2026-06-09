"""Org router — hierarchy tree, user search, manager assignment."""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.routers.auth import get_current_user, require_role
from backend.utils.org import build_org_tree, get_subtree_user_ids

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/org", tags=["org"])


# ── GET /api/org/tree ─────────────────────────────────────────────────────────

@router.get("/tree")
def org_tree(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Return the org tree visible to the current user.

    - Admin: full org tree
    - Manager: their own subtree
    - Employee: their branch (manager + themselves + their direct reports)
    """
    if current_user.role == "admin":
        users = db.query(User).filter(User.is_active == True).all()  # noqa: E712
    elif current_user.role == "manager":
        subtree_ids = get_subtree_user_ids(db, current_user.id)
        # Also include current_user's own manager so context is visible
        if current_user.manager_id:
            subtree_ids.add(current_user.manager_id)
        users = db.query(User).filter(User.id.in_(subtree_ids)).all()
    else:
        # Employee: show themselves, their manager, and their direct reports
        visible_ids = {current_user.id}
        if current_user.manager_id:
            visible_ids.add(current_user.manager_id)
        direct_reports = db.query(User.id).filter(User.manager_id == current_user.id).all()
        visible_ids.update(r[0] for r in direct_reports)
        users = db.query(User).filter(User.id.in_(visible_ids)).all()

    return build_org_tree(users)


# ── GET /api/org/users/search ─────────────────────────────────────────────────

@router.get("/users/search")
def search_users(
    q: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Search users by name or email — used for manager picker in onboarding."""
    query = db.query(User).filter(User.is_active == True)  # noqa: E712
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.filter(
            User.full_name.ilike(pattern) | User.email.ilike(pattern)
        )
    users = query.order_by(User.full_name).limit(limit).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "employee_id": u.employee_id,
            "role": u.role,
            "department": u.department,
        }
        for u in users
        if u.id != current_user.id  # exclude self from manager search
    ]


# ── PUT /api/org/users/{user_id}/manager ─────────────────────────────────────

class SetManagerRequest(BaseModel):
    manager_id: Optional[str] = None  # None = remove manager (top-level)


@router.put("/users/{user_id}/manager")
def set_manager(
    user_id: str,
    payload: SetManagerRequest,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Assign or remove a user's manager (admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.manager_id is not None:
        manager = db.query(User).filter(User.id == payload.manager_id).first()
        if manager is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
        # Prevent cycle: manager cannot be a report of the target
        if payload.manager_id == user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User cannot be their own manager")
        subtree = get_subtree_user_ids(db, user_id)
        if payload.manager_id in subtree:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create a reporting cycle")

    target.manager_id = payload.manager_id
    db.commit()
    logger.info("Admin %s set manager for %s → %s", current_user.employee_id, target.employee_id, payload.manager_id)
    return {"id": target.id, "manager_id": target.manager_id}
