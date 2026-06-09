"""Org hierarchy utilities — subtree traversal and tree building."""

from __future__ import annotations

from typing import Any
from collections import defaultdict

from sqlalchemy.orm import Session

from backend.models.user import User


def get_subtree_user_ids(db: Session, root_id: str) -> set[str]:
    """Return the set of all user IDs in the subtree rooted at root_id (inclusive).

    Uses breadth-first traversal via manager_id links.
    Safe for deep hierarchies — no recursion, no SQL recursion.
    """
    result: set[str] = set()
    queue: list[str] = [root_id]
    while queue:
        current = queue.pop()
        if current in result:
            continue  # cycle guard
        result.add(current)
        direct_reports = (
            db.query(User.id)
            .filter(User.manager_id == current, User.is_active == True)  # noqa: E712
            .all()
        )
        queue.extend(r[0] for r in direct_reports)
    return result


def build_org_tree(users: list[User]) -> list[dict[str, Any]]:
    """Convert a flat list of User objects into a nested tree.

    Returns a list of root nodes (users with no manager in the provided list).
    Each node: { id, full_name, employee_id, role, department, team_name, reports: [...] }
    """
    by_id: dict[str, dict] = {}
    children: dict[str, list[str]] = defaultdict(list)
    ids_in_set = {u.id for u in users}

    for u in users:
        by_id[u.id] = {
            "id": u.id,
            "full_name": u.full_name,
            "employee_id": u.employee_id,
            "role": u.role,
            "department": u.department,
            "team_name": u.team_name,
            "email": u.email,
            "is_active": u.is_active,
            "manager_id": u.manager_id,
            "reports": [],
        }
        # Only wire up to parent if parent is in the visible set
        if u.manager_id and u.manager_id in ids_in_set:
            children[u.manager_id].append(u.id)

    # Attach children
    for parent_id, child_ids in children.items():
        if parent_id in by_id:
            by_id[parent_id]["reports"] = [by_id[c] for c in child_ids if c in by_id]

    # Roots = users whose manager is NOT in the set (or no manager)
    roots = [
        node for node in by_id.values()
        if node["manager_id"] is None or node["manager_id"] not in ids_in_set
    ]
    return roots
