"""
Shared fixtures for integration tests.

All tests in this directory make real LLM API calls.
They are automatically skipped when API keys are not available.

Run with:
    pytest -m integration
    pytest tests/integration/            # same thing
    pytest tests/integration/ -v -s      # verbose, see LLM output
"""

import json
import os
import uuid
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base


def _llm_keys_available() -> bool:
    """Return True if at least one LLM API key is accessible."""
    config_blob = os.getenv("APP_SERVICE_CONFIG")
    if config_blob:
        try:
            data = json.loads(config_blob)
            if data.get("AWS_BEDROCK_KEY") or data.get("APP_SERVICE_NLP_API_KEY"):
                return True
        except (json.JSONDecodeError, ValueError):
            pass
    return bool(os.getenv("AWS_BEDROCK_KEY") or os.getenv("APP_SERVICE_NLP_API_KEY"))


# Skip entire module if keys unavailable
pytestmark = pytest.mark.skipif(
    not _llm_keys_available(),
    reason="LLM API keys not available — set AWS_BEDROCK_KEY or APP_SERVICE_NLP_API_KEY",
)

# ── Shared in-memory DB for integration tests ─────────────────────────────────

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(autouse=True)
def setup_integration_db():
    from backend.models import chat_history, user, work_item, work_log  # noqa: F401
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db():
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def seeded_db(db):
    """DB pre-populated with a user and a few confirmed work items."""
    from backend.models.user import User
    from backend.models.work_item import WorkItem
    from backend.models.work_log import WorkLog

    today = date.today()

    user = User(
        employee_id="EMP-INT",
        full_name="Integration Tester",
        email="integration@test.com",
        hashed_password="irrelevant",
        role="employee",
    )
    db.add(user)
    db.flush()

    log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        work_date=today,
        raw_message="fixed preprocessing issues of chatbot, it took 2 hours and its completed",
        extraction_status="success",
    )
    db.add(log)
    db.flush()

    items = [
        WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=today,
            task_description="Fixed preprocessing issues of chatbot",
            work_category="ticket",
            hours_spent=2.0,
            status="done",
        ),
        WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=today,
            task_description="Attended team standup meeting",
            work_category="meeting",
            hours_spent=0.5,
            status="done",
        ),
    ]
    for item in items:
        db.add(item)
    db.commit()
    return user, items
