"""Shared pytest fixtures for WorkTrack AI tests."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.main import app

# ── In-memory SQLite for tests ────────────────────────────────────────────────
# StaticPool forces all connections to share the same :memory: database so that
# tables created by one connection are visible to queries on another connection.
TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Create all tables before each test and drop them after."""
    from backend.models import user, work_log, work_item, chat_history  # noqa: F401
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    """Yield a test database session."""
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """FastAPI TestClient with the test DB injected."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper: register a user and return token ──────────────────────────────────

def register_user(client, employee_id="EMP-001", role="employee", email="test@example.com",
                  password="password123", full_name="Test User"):
    resp = client.post("/auth/register", json={
        "employee_id": employee_id,
        "full_name": full_name,
        "email": email,
        "password": password,
        "role": role,
    })
    assert resp.status_code == 201, resp.json()
    return resp.json()["access_token"]
