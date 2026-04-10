"""Unit tests for auth_service: JWT and password helpers."""

from datetime import timedelta

import pytest
from jose import JWTError

from backend.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
    authenticate_user,
    get_user_by_email,
)
from backend.models.user import User


# ── Password hashing ──────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plain_text(self):
        hashed = hash_password("mysecret")
        assert hashed != "mysecret"

    def test_verify_correct_password(self):
        hashed = hash_password("correcthorse")
        assert verify_password("correcthorse", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correcthorse")
        assert verify_password("wrongpassword", hashed) is False

    def test_hash_same_password_produces_different_hashes(self):
        h1 = hash_password("samepassword")
        h2 = hash_password("samepassword")
        assert h1 != h2  # bcrypt uses random salt


# ── JWT ───────────────────────────────────────────────────────────────────────

class TestJWT:
    def test_create_and_decode_token(self):
        token = create_access_token(
            user_id="user-123",
            email="alice@example.com",
            role="employee",
            employee_id="EMP-001",
        )
        data = decode_access_token(token)
        assert data.user_id == "user-123"
        assert data.email == "alice@example.com"
        assert data.role == "employee"
        assert data.employee_id == "EMP-001"

    def test_decode_invalid_token_raises(self):
        with pytest.raises(JWTError):
            decode_access_token("not.a.valid.token")

    def test_expired_token_raises(self):
        token = create_access_token(
            user_id="u",
            email="e@e.com",
            role="employee",
            employee_id="EMP-001",
            expires_delta=timedelta(seconds=-1),  # already expired
        )
        with pytest.raises(JWTError):
            decode_access_token(token)

    def test_role_is_preserved_in_token(self):
        for role in ("employee", "manager", "admin"):
            token = create_access_token("u", "e@e.com", role, "EMP-001")
            assert decode_access_token(token).role == role


# ── DB helpers ────────────────────────────────────────────────────────────────

class TestDBHelpers:
    def test_get_user_by_email_found(self, db):
        user = User(
            employee_id="EMP-001",
            full_name="Alice",
            email="alice@example.com",
            hashed_password=hash_password("pass"),
            role="employee",
        )
        db.add(user)
        db.commit()

        found = get_user_by_email(db, "alice@example.com")
        assert found is not None
        assert found.employee_id == "EMP-001"

    def test_get_user_by_email_not_found(self, db):
        assert get_user_by_email(db, "nobody@example.com") is None

    def test_authenticate_user_success(self, db):
        user = User(
            employee_id="EMP-002",
            full_name="Bob",
            email="bob@example.com",
            hashed_password=hash_password("secret99"),
            role="employee",
        )
        db.add(user)
        db.commit()

        result = authenticate_user(db, "bob@example.com", "secret99")
        assert result is not None
        assert result.email == "bob@example.com"

    def test_authenticate_user_wrong_password(self, db):
        user = User(
            employee_id="EMP-003",
            full_name="Carol",
            email="carol@example.com",
            hashed_password=hash_password("correct"),
            role="employee",
        )
        db.add(user)
        db.commit()

        result = authenticate_user(db, "carol@example.com", "wrong")
        assert result is None

    def test_authenticate_user_not_found(self, db):
        assert authenticate_user(db, "ghost@example.com", "pass") is None
