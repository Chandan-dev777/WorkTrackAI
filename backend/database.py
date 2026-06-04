"""SQLAlchemy engine, session factory, and base class.

Supports two modes:
  - SQLite (local dev): DATABASE_URL starts with sqlite:///
  - PostgreSQL / Uptimize DBaaS (production): DATABASE_URL starts with postgresql://
    Uses IAM auth token rotation via boto3 when DBAAS_IAM_ROLE is set.
"""

import logging
import os
import time

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from backend.config import settings

logger = logging.getLogger(__name__)


def _is_postgres() -> bool:
    return settings.DATABASE_URL.startswith("postgresql")


def _resolve_db_url(url: str) -> str:
    """Ensure the parent directory exists for SQLite databases."""
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        parent = os.path.dirname(os.path.abspath(path))
        os.makedirs(parent, exist_ok=True)
    return url


def _generate_iam_token() -> str:
    """Generate a fresh IAM auth token for Uptimize DBaaS PostgreSQL."""
    import boto3

    iam_role = settings.DBAAS_IAM_ROLE
    db_host = settings.DBAAS_HOST
    db_port = settings.DBAAS_PORT
    db_user = settings.DBAAS_USER
    region = settings.DBAAS_REGION

    sts = boto3.client("sts", endpoint_url=f"https://sts.{region}.amazonaws.com")
    credentials = sts.assume_role(
        RoleArn=iam_role,
        RoleSessionName=f"dailyops-ai-{int(time.time() * 1000)}",
        DurationSeconds=3600,
    )["Credentials"]

    rds = boto3.client(
        "rds",
        region_name=region,
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )

    token = rds.generate_db_auth_token(
        DBHostname=db_host,
        Port=db_port,
        DBUsername=db_user,
        Region=region,
    )
    logger.info("Generated fresh IAM auth token for DBaaS (valid 15 min)")
    return token


def _build_engine():
    """Build the SQLAlchemy engine based on DATABASE_URL."""
    if _is_postgres():
        url = _resolve_db_url(settings.DATABASE_URL)
        eng = create_engine(
            url,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=600,
            echo=False,
        )

        if settings.DBAAS_IAM_ROLE:
            @event.listens_for(eng, "do_connect")
            def provide_iam_token(dialect, conn_rec, cargs, cparams):
                cparams["password"] = _generate_iam_token()

        return eng
    else:
        url = _resolve_db_url(settings.DATABASE_URL)
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
        )


engine = _build_engine()

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
    from backend.models import assistant_note, chat_history, user, user_template, work_item, work_log  # noqa: F401

    Base.metadata.create_all(bind=engine)


def run_migrations() -> None:
    """Apply additive schema migrations.

    For SQLite: uses PRAGMA table_info to check existing columns.
    For PostgreSQL: uses information_schema.
    """
    _MIGRATIONS = [
        ("work_items", "logical_task_id", "VARCHAR(36)"),
        ("work_items", "continuation_of", "VARCHAR(36)"),
    ]

    with engine.connect() as conn:
        for table, column, col_type in _MIGRATIONS:
            if _is_postgres():
                result = conn.execute(
                    __import__("sqlalchemy").text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :table AND column_name = :column"
                    ),
                    {"table": table, "column": column},
                ).fetchone()
                if result is None:
                    conn.execute(
                        __import__("sqlalchemy").text(
                            f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
                        )
                    )
                    conn.commit()
            else:
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
