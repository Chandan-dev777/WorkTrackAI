"""
Seed script — Phase 1 (users) + Phase 5 (work logs).

Creates 3 managers + 12 employees across Engineering, Data, and Support teams,
plus an admin user. Then seeds 30 days of realistic work logs for each employee.

Usage:
    python -m backend.seed_data
"""

import logging
import random
import uuid
from datetime import date, timedelta

from backend.database import SessionLocal, create_tables
from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.services.auth_service import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


TEAMS = [
    {
        "manager": {
            "employee_id": "MGR-ENG-001",
            "full_name": "Sarah Connor",
            "email": "sarah.connor@dailyops.ai",
            "role": "manager",
            "team_name": "Engineering",
            "department": "Technology",
        },
        "members": [
            {"employee_id": "EMP-ENG-001", "full_name": "John Reese",      "email": "john.reese@dailyops.ai"},
            {"employee_id": "EMP-ENG-002", "full_name": "Kate Brewster",   "email": "kate.brewster@dailyops.ai"},
            {"employee_id": "EMP-ENG-003", "full_name": "Miles Dyson",     "email": "miles.dyson@dailyops.ai"},
            {"employee_id": "EMP-ENG-004", "full_name": "Tarissa Dyson",   "email": "tarissa.dyson@dailyops.ai"},
        ],
    },
    {
        "manager": {
            "employee_id": "MGR-DAT-001",
            "full_name": "Grace Hopper",
            "email": "grace.hopper@dailyops.ai",
            "role": "manager",
            "team_name": "Data",
            "department": "Technology",
        },
        "members": [
            {"employee_id": "EMP-DAT-001", "full_name": "Alan Turing",     "email": "alan.turing@dailyops.ai"},
            {"employee_id": "EMP-DAT-002", "full_name": "Ada Lovelace",    "email": "ada.lovelace@dailyops.ai"},
            {"employee_id": "EMP-DAT-003", "full_name": "Claude Shannon",  "email": "claude.shannon@dailyops.ai"},
            {"employee_id": "EMP-DAT-004", "full_name": "Norbert Wiener",  "email": "norbert.wiener@dailyops.ai"},
        ],
    },
    {
        "manager": {
            "employee_id": "MGR-SUP-001",
            "full_name": "Linus Torvalds",
            "email": "linus.torvalds@dailyops.ai",
            "role": "manager",
            "team_name": "Support",
            "department": "Operations",
        },
        "members": [
            {"employee_id": "EMP-SUP-001", "full_name": "Guido van Rossum", "email": "guido.vanrossum@dailyops.ai"},
            {"employee_id": "EMP-SUP-002", "full_name": "Bjarne Stroustrup","email": "bjarne.stroustrup@dailyops.ai"},
            {"employee_id": "EMP-SUP-003", "full_name": "Dennis Ritchie",   "email": "dennis.ritchie@dailyops.ai"},
            {"employee_id": "EMP-SUP-004", "full_name": "Ken Thompson",     "email": "ken.thompson@dailyops.ai"},
        ],
    },
]

ADMIN_USER = {
    "employee_id": "ADMIN-001",
    "full_name": "System Admin",
    "email": "admin@dailyops.ai",
    "role": "admin",
    "team_name": None,
    "department": None,
}

DEFAULT_PASSWORD = "DailyOps2026!"

# ── Work item templates per team ──────────────────────────────────────────────

_ENGINEERING_TASKS = [
    ("Implemented REST endpoint for user profile updates", "ticket", 2.0, "done", "high", "PROJ-Auth"),
    ("Reviewed pull request for payment gateway integration", "review", 1.5, "done", "medium", None),
    ("Fixed null pointer exception in session handler", "ticket", 1.0, "done", "high", "BUG-442"),
    ("Refactored database connection pooling logic", "project", 3.0, "in_progress", "medium", "PROJ-Infra"),
    ("Attended sprint planning meeting", "meeting", 1.0, "done", None, None),
    ("Wrote unit tests for authentication module", "ticket", 2.5, "done", "medium", "PROJ-Auth"),
    ("Investigated intermittent timeout errors in prod", "ticket", 1.5, "in_progress", "high", "BUG-509"),
    ("Updated API documentation for v2 endpoints", "documentation", 1.0, "done", "low", None),
    ("Code review for onboarding feature branch", "review", 1.0, "done", "medium", None),
    ("Set up CI pipeline for new microservice", "project", 2.0, "done", "high", "PROJ-CI"),
    ("Blocked: waiting for design specs on new dashboard", "ticket", 0.5, "blocked", "medium", None),
    ("Worked on data migration script for v2 schema", "project", 3.0, "in_progress", "high", "PROJ-Migration"),
]

_DATA_TASKS = [
    ("Built ETL pipeline for daily sales data ingestion", "project", 4.0, "in_progress", "high", "PROJ-ETL"),
    ("Ran data quality checks on customer records", "ticket", 2.0, "done", "medium", "DQ-101"),
    ("Attended data governance meeting", "meeting", 1.5, "done", None, None),
    ("Investigated anomaly in weekly revenue report", "ticket", 2.5, "in_progress", "high", "BUG-Data-77"),
    ("Created Polaris classification model prototype", "polaris_classification", 3.0, "in_progress", "high", None),
    ("Updated feature store pipeline", "project", 2.0, "done", "medium", "PROJ-FS"),
    ("Documented ML pipeline architecture", "documentation", 1.0, "done", "low", None),
    ("Reviewed data analyst SQL queries for efficiency", "review", 1.0, "done", "medium", None),
    ("Blocked: prod database access permissions not granted yet", "ticket", 0.5, "blocked", "high", None),
    ("Worked on NLP classification model training", "project", 3.5, "in_progress", "high", "PROJ-NLP"),
    ("Optimised slow-running aggregation queries", "ticket", 2.0, "done", "medium", "PERF-33"),
    ("Team sync on Q2 data roadmap", "meeting", 1.0, "done", None, None),
]

_SUPPORT_TASKS = [
    ("Resolved customer escalation for billing issue", "support", 2.0, "done", "high", "SUP-2201"),
    ("Updated knowledge base articles for new feature", "documentation", 1.5, "done", "low", None),
    ("Triaged incoming support tickets", "support", 2.0, "done", "medium", None),
    ("Attended weekly support team standup", "meeting", 0.5, "done", None, None),
    ("Investigated data export failure reported by client", "ticket", 1.5, "in_progress", "high", "BUG-Export-14"),
    ("Trained junior support team member", "other", 2.0, "done", "medium", None),
    ("Escalated unresolved authentication bug to engineering", "support", 1.0, "done", "high", "SUP-2287"),
    ("Blocked: waiting for engineering team response on ticket", "support", 0.5, "blocked", "medium", "SUP-2299"),
    ("Prepared monthly support metrics report", "admin", 2.0, "done", "medium", None),
    ("Tested new onboarding flow for regressions", "ticket", 2.0, "done", "medium", "QA-55"),
    ("Reviewed and closed stale support tickets", "support", 1.5, "done", "low", None),
    ("Onboarding admin tasks and account setup", "admin", 1.0, "done", "low", None),
]

_TEAM_TASKS = {
    "Engineering": _ENGINEERING_TASKS,
    "Data": _DATA_TASKS,
    "Support": _SUPPORT_TASKS,
}

# Edge case entries mixed in at random
_EDGE_CASES = [
    # Missing hours — hours_spent=None
    ("Looked into that prod issue", "ticket", None, "in_progress", None, None),
    # Vague language
    ("Did some work today", "other", 1.0, "done", None, None),
    # One-liner
    ("Meetings", "meeting", 2.0, "done", None, None),
    # Flagged for review
    ("Worked on something but unsure of category", "other", 1.0, "in_progress", None, None),
]


def _is_weekday(d: date) -> bool:
    return d.weekday() < 5  # Mon–Fri


def seed(db) -> int:
    """
    Idempotent seed function.

    Seeds users and then work logs. Skips if any users already exist.
    Returns the number of users created (0 if already seeded).
    """
    existing = db.query(User).count()
    if existing > 0:
        logger.info("Database already has %d users — skipping seed.", existing)
        return 0

    created_users = 0

    # Admin
    admin = User(
        employee_id=ADMIN_USER["employee_id"],
        full_name=ADMIN_USER["full_name"],
        email=ADMIN_USER["email"],
        hashed_password=hash_password(DEFAULT_PASSWORD),
        role=ADMIN_USER["role"],
        team_name=ADMIN_USER["team_name"],
        department=ADMIN_USER["department"],
    )
    db.add(admin)
    db.flush()
    created_users += 1
    logger.info("Created admin: %s", admin.email)

    for team_data in TEAMS:
        mgr_data = team_data["manager"]
        manager = User(
            employee_id=mgr_data["employee_id"],
            full_name=mgr_data["full_name"],
            email=mgr_data["email"],
            hashed_password=hash_password(DEFAULT_PASSWORD),
            role=mgr_data["role"],
            team_name=mgr_data["team_name"],
            department=mgr_data["department"],
        )
        db.add(manager)
        db.flush()
        created_users += 1
        logger.info("Created manager: %s (%s)", manager.email, manager.team_name)

        for mem_data in team_data["members"]:
            member = User(
                employee_id=mem_data["employee_id"],
                full_name=mem_data["full_name"],
                email=mem_data["email"],
                hashed_password=hash_password(DEFAULT_PASSWORD),
                role="employee",
                team_name=mgr_data["team_name"],
                department=mgr_data["department"],
                manager_id=manager.id,
            )
            db.add(member)
            db.flush()
            created_users += 1
            logger.info("Created employee: %s", member.email)

    db.commit()
    logger.info("User seed complete — %d users created. Default password: %s", created_users, DEFAULT_PASSWORD)

    seed_work_logs(db)

    return created_users


def seed_work_logs(db) -> int:
    """
    Seed 30 days of work logs for all employees.

    Skips if any work logs already exist.
    Returns the number of WorkItem records created.
    """
    existing_logs = db.query(WorkLog).count()
    if existing_logs > 0:
        logger.info("Work logs already exist (%d) — skipping work log seed.", existing_logs)
        return 0

    employees = db.query(User).filter(User.role == "employee").all()
    if not employees:
        logger.warning("No employees found — skipping work log seed.")
        return 0

    today = date.today()
    rng = random.Random(42)  # deterministic seed for reproducibility

    total_items = 0

    for emp in employees:
        team_tasks = _TEAM_TASKS.get(emp.team_name, _SUPPORT_TASKS)

        for day_offset in range(30):
            work_date = today - timedelta(days=day_offset)
            if not _is_weekday(work_date):
                continue

            # ~10% chance of skipping a day (simulating absence/PTO)
            if rng.random() < 0.10:
                continue

            # ~10% chance of an edge case entry
            if rng.random() < 0.10:
                task_desc, category, hours, status_val, priority, ticket = rng.choice(_EDGE_CASES)
                items_for_day = [(task_desc, category, hours, status_val, priority, ticket, True)]
                extraction_status = "needs_review"
            else:
                n_tasks = rng.randint(1, 3)
                chosen = rng.sample(team_tasks, min(n_tasks, len(team_tasks)))
                items_for_day = [
                    (desc, cat, hrs, st, pri, tkt, False)
                    for desc, cat, hrs, st, pri, tkt in chosen
                ]
                extraction_status = "success"

            log = WorkLog(
                id=str(uuid.uuid4()),
                user_id=emp.id,
                work_date=work_date,
                raw_message=f"Seed data for {emp.full_name} on {work_date.isoformat()}",
                extraction_status=extraction_status,
                model_name="seed",
                parse_version="1.0",
            )
            db.add(log)
            db.flush()

            for task_desc, category, hours, status_val, priority, ticket, needs_review in items_for_day:
                item = WorkItem(
                    id=str(uuid.uuid4()),
                    work_log_id=log.id,
                    employee_id=emp.employee_id,
                    work_date=work_date,
                    task_description=task_desc,
                    work_category=category,
                    hours_spent=hours,
                    status=status_val,
                    priority=priority,
                    ticket_id=ticket,
                    needs_review=needs_review,
                )
                db.add(item)
                total_items += 1

    db.commit()
    logger.info(
        "Work log seed complete — %d work items created for %d employees",
        total_items, len(employees),
    )
    return total_items


if __name__ == "__main__":
    create_tables()
    with SessionLocal() as db:
        seed(db)
