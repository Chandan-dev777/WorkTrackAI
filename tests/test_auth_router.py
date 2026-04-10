"""Integration tests for auth router: /auth/register, /auth/login, /auth/me."""

import pytest
from tests.conftest import register_user


class TestRegister:
    def test_register_success(self, client):
        resp = client.post("/auth/register", json={
            "employee_id": "EMP-001",
            "full_name": "Alice Smith",
            "email": "alice@example.com",
            "password": "password123",
            "role": "employee",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_register_duplicate_email_returns_409(self, client):
        register_user(client)
        resp = client.post("/auth/register", json={
            "employee_id": "EMP-002",
            "full_name": "Alice Clone",
            "email": "test@example.com",  # same email as default in register_user
            "password": "password123",
        })
        assert resp.status_code == 409

    def test_register_short_password_returns_422(self, client):
        resp = client.post("/auth/register", json={
            "employee_id": "EMP-001",
            "full_name": "Bob",
            "email": "bob@example.com",
            "password": "short",
        })
        assert resp.status_code == 422

    def test_register_invalid_email_returns_422(self, client):
        resp = client.post("/auth/register", json={
            "employee_id": "EMP-001",
            "full_name": "Bob",
            "email": "not-an-email",
            "password": "password123",
        })
        assert resp.status_code == 422

    def test_register_manager_role(self, client):
        resp = client.post("/auth/register", json={
            "employee_id": "MGR-001",
            "full_name": "Manager Mary",
            "email": "mary@example.com",
            "password": "password123",
            "role": "manager",
        })
        assert resp.status_code == 201

    def test_register_with_team_and_department(self, client):
        resp = client.post("/auth/register", json={
            "employee_id": "EMP-010",
            "full_name": "Dave",
            "email": "dave@example.com",
            "password": "password123",
            "team_name": "Engineering",
            "department": "Product",
        })
        assert resp.status_code == 201


class TestLogin:
    def test_login_success(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password_returns_401(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_login_unknown_email_returns_401(self, client):
        resp = client.post("/auth/login", json={
            "email": "nobody@example.com",
            "password": "password123",
        })
        assert resp.status_code == 401

    def test_login_invalid_email_format_returns_422(self, client):
        resp = client.post("/auth/login", json={
            "email": "not-email",
            "password": "password123",
        })
        assert resp.status_code == 422


class TestMe:
    def test_me_returns_profile(self, client):
        token = register_user(client, employee_id="EMP-001", role="employee",
                               full_name="Alice Smith")
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["employee_id"] == "EMP-001"
        assert body["role"] == "employee"
        assert body["email"] == "test@example.com"
        assert body["full_name"] == "Alice Smith"
        assert body["is_active"] is True

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code in (401, 403)  # HTTPBearer returns 403; some versions return 401

    def test_me_with_invalid_token_returns_401(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401

    def test_me_role_is_manager(self, client):
        token = register_user(client, employee_id="MGR-001", role="manager",
                               email="mgr@example.com")
        resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.json()["role"] == "manager"

    def test_token_from_login_works_for_me(self, client):
        register_user(client)
        login_resp = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        token = login_resp.json()["access_token"]
        me_resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "test@example.com"
