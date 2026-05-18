"""SQLAlchemy engine, session factory, and base class."""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import settings


def _resolve_db_url(url: str) -> str:
    """Ensure the parent directory exists for SQLite databases."""
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)
    return url


engine = create_engine(
    _resolve_db_url(settings.DATABASE_URL),
    connect_args={"check_same_thread": False},  # required for SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields a database session and closes it after use."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables. Called once on app startup."""
    # Import models so they register with Base.metadata before create_all
    from backend.models import assistant_note, chat_history, user, work_item, work_log  # noqa: F401

    Base.metadata.create_all(bind=engine)


def run_migrations() -> None:
    """Apply additive schema migrations for SQLite (ALTER TABLE ADD COLUMN).

    SQLite has no IF NOT EXISTS for columns, so we check PRAGMA table_info first.
    Safe to run on every startup — skips columns that already exist.
    """
    _MIGRATIONS = [
        ("work_items", "logical_task_id", "VARCHAR(36)"),
        ("work_items", "continuation_of", "VARCHAR(36)"),
    ]
    with engine.connect() as conn:
        for table, column, col_type in _MIGRATIONS:
            existing = [
                row[1]
                for row in conn.execute(
                    __import__("sqlalchemy").text(f"PRAGMA table_info({table})")
                ).fetchall()
            ]
            if column not in existing:
                conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                    )
                )
                conn.commit()
