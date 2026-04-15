"""Tests for assistant_service: note CRUD with role-based visibility."""

import pytest

from backend.models.user import User
from backend.services.assistant_service import (
    create_note,
    list_notes,
    update_note,
    delete_note,
    NoteNotFoundError,
    NoteAccessError,
)
from backend.services.auth_service import hash_password


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_user(db, employee_id="EMP-001", role="employee", email="u@x.com"):
    user = User(
        employee_id=employee_id,
        full_name="Test User",
        email=email,
        hashed_password=hash_password("pass"),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _note_payload(**overrides):
    base = {
        "type": "bug",
        "title": "Test bug",
        "body": "Something is broken",
        "priority": "medium",
        "affected_page": "My Dashboard",
    }
    return {**base, **overrides}


# ── create_note ───────────────────────────────────────────────────────────────

class TestCreateNote:
    def test_creates_bug_note(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload())
        assert note.id is not None
        assert note.type == "bug"
        assert note.title == "Test bug"
        assert note.user_id == user.id
        assert note.status == "open"

    def test_creates_requirement_note(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload(type="requirement", title="Weekly digest"))
        assert note.type == "requirement"
        assert note.status == "open"

    def test_creates_feedback_note(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload(type="feedback", title="Great UX!"))
        assert note.type == "feedback"

    def test_affected_page_is_optional(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload(affected_page=None))
        assert note.affected_page is None

    def test_none_priority_defaults_to_medium(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, type="bug", title="T", body="B", priority=None)
        assert note.priority == "medium"

    def test_critical_priority_accepted(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload(priority="critical"))
        assert note.priority == "critical"


# ── list_notes ────────────────────────────────────────────────────────────────

class TestListNotes:
    def test_employee_sees_only_own_notes(self, db):
        emp_a = _make_user(db, "EMP-A", email="a@x.com")
        emp_b = _make_user(db, "EMP-B", email="b@x.com")
        create_note(db, emp_a.id, **_note_payload(title="A's note"))
        create_note(db, emp_b.id, **_note_payload(title="B's note"))

        notes = list_notes(db, requesting_user=emp_a)
        assert len(notes) == 1
        assert notes[0].title == "A's note"

    def test_manager_sees_all_notes(self, db):
        manager = _make_user(db, "MGR-01", role="manager", email="mgr@x.com")
        emp_a = _make_user(db, "EMP-A", email="a@x.com")
        emp_b = _make_user(db, "EMP-B", email="b@x.com")
        create_note(db, emp_a.id, **_note_payload(title="A's note"))
        create_note(db, emp_b.id, **_note_payload(title="B's note"))

        notes = list_notes(db, requesting_user=manager)
        assert len(notes) == 2

    def test_admin_sees_all_notes(self, db):
        admin = _make_user(db, "ADM-01", role="admin", email="admin@x.com")
        emp = _make_user(db, "EMP-A", email="a@x.com")
        create_note(db, emp.id, **_note_payload())
        create_note(db, emp.id, **_note_payload(title="Second"))

        notes = list_notes(db, requesting_user=admin)
        assert len(notes) == 2

    def test_filter_by_type(self, db):
        user = _make_user(db)
        create_note(db, user.id, **_note_payload(type="bug"))
        create_note(db, user.id, **_note_payload(type="requirement", title="Req 1"))

        bugs = list_notes(db, requesting_user=user, type_filter="bug")
        assert len(bugs) == 1
        assert bugs[0].type == "bug"

    def test_filter_by_status(self, db):
        user = _make_user(db)
        create_note(db, user.id, **_note_payload(title="Open bug"))
        note2 = create_note(db, user.id, **_note_payload(title="Resolved bug"))
        update_note(db, note2.id, user.id, user.role, status="resolved")

        open_notes = list_notes(db, requesting_user=user, status_filter="open")
        assert len(open_notes) == 1
        assert open_notes[0].title == "Open bug"

    def test_returns_empty_when_no_notes(self, db):
        user = _make_user(db)
        assert list_notes(db, requesting_user=user) == []

    def test_ordered_newest_first(self, db):
        user = _make_user(db)
        create_note(db, user.id, **_note_payload(title="First"))
        create_note(db, user.id, **_note_payload(title="Second"))

        notes = list_notes(db, requesting_user=user)
        assert notes[0].title == "Second"
        assert notes[1].title == "First"


# ── update_note ───────────────────────────────────────────────────────────────

class TestUpdateNote:
    def test_owner_can_update_status(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload())
        updated = update_note(db, note.id, user.id, user.role, status="resolved")
        assert updated.status == "resolved"

    def test_owner_can_update_priority(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload(priority="low"))
        updated = update_note(db, note.id, user.id, user.role, priority="critical")
        assert updated.priority == "critical"

    def test_owner_can_update_title_and_body(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload())
        updated = update_note(db, note.id, user.id, user.role, title="New title", body="New body")
        assert updated.title == "New title"
        assert updated.body == "New body"

    def test_employee_cannot_update_others_note(self, db):
        owner = _make_user(db, "EMP-A", email="a@x.com")
        other = _make_user(db, "EMP-B", email="b@x.com")
        note = create_note(db, owner.id, **_note_payload())

        with pytest.raises(NoteAccessError):
            update_note(db, note.id, other.id, other.role, status="resolved")

    def test_manager_can_update_any_note(self, db):
        emp = _make_user(db, "EMP-A", email="a@x.com")
        manager = _make_user(db, "MGR-01", role="manager", email="mgr@x.com")
        note = create_note(db, emp.id, **_note_payload())
        updated = update_note(db, note.id, manager.id, manager.role, status="acknowledged")
        assert updated.status == "acknowledged"

    def test_admin_can_update_any_note(self, db):
        emp = _make_user(db, "EMP-A", email="a@x.com")
        admin = _make_user(db, "ADM-01", role="admin", email="admin@x.com")
        note = create_note(db, emp.id, **_note_payload())
        updated = update_note(db, note.id, admin.id, admin.role, status="in_progress")
        assert updated.status == "in_progress"

    def test_update_nonexistent_note_raises(self, db):
        user = _make_user(db)
        with pytest.raises(NoteNotFoundError):
            update_note(db, "nonexistent-id", user.id, user.role, status="resolved")


# ── delete_note ───────────────────────────────────────────────────────────────

class TestDeleteNote:
    def test_owner_can_delete_own_note(self, db):
        user = _make_user(db)
        note = create_note(db, user.id, **_note_payload())
        delete_note(db, note.id, user.id, user.role)
        assert list_notes(db, requesting_user=user) == []

    def test_employee_cannot_delete_others_note(self, db):
        owner = _make_user(db, "EMP-A", email="a@x.com")
        other = _make_user(db, "EMP-B", email="b@x.com")
        note = create_note(db, owner.id, **_note_payload())

        with pytest.raises(NoteAccessError):
            delete_note(db, note.id, other.id, other.role)

    def test_admin_can_delete_any_note(self, db):
        emp = _make_user(db, "EMP-A", email="a@x.com")
        admin = _make_user(db, "ADM-01", role="admin", email="admin@x.com")
        note = create_note(db, emp.id, **_note_payload())
        delete_note(db, note.id, admin.id, admin.role)
        assert list_notes(db, requesting_user=admin) == []

    def test_delete_nonexistent_raises(self, db):
        user = _make_user(db)
        with pytest.raises(NoteNotFoundError):
            delete_note(db, "no-such-id", user.id, user.role)
