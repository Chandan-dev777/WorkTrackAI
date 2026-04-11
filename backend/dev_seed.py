"""
Dev seed script — adds realistic users and work history for manual testing.

- Keeps existing users untouched (chandan, temp_1, etc.)
- Adds employees to ChatBots team + 3 new teams (Engineering, Data Science, Support)
- Seeds 30 days of realistic work history for every employee and manager
- No LLM calls — inserts directly into SQLite

Usage:
    python -m backend.dev_seed

Credentials for all NEW accounts:  WorkTrack2026!
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

DEFAULT_PASSWORD = "WorkTrack2026!"

# ── Team definitions ──────────────────────────────────────────────────────────

TEAMS = [
    {
        "team_name": "ChatBots",
        "department": "It",
        "manager": None,  # existing chandan — resolved at runtime
        "new_employees": [
            {"employee_id": "EMP-CB-001", "full_name": "Priya Sharma",    "email": "priya.sharma@worktrack.ai"},
            {"employee_id": "EMP-CB-002", "full_name": "Luca Rossi",      "email": "luca.rossi@worktrack.ai"},
            {"employee_id": "EMP-CB-003", "full_name": "Aiko Tanaka",     "email": "aiko.tanaka@worktrack.ai"},
            {"employee_id": "EMP-CB-004", "full_name": "Omar Khalid",     "email": "omar.khalid@worktrack.ai"},
        ],
    },
    {
        "team_name": "Engineering",
        "department": "Technology",
        "manager": {
            "employee_id": "MGR-ENG-001",
            "full_name": "Sarah Connor",
            "email": "sarah.connor@worktrack.ai",
            "role": "manager",
        },
        "new_employees": [
            {"employee_id": "EMP-ENG-001", "full_name": "John Reese",      "email": "john.reese@worktrack.ai"},
            {"employee_id": "EMP-ENG-002", "full_name": "Kate Brewster",   "email": "kate.brewster@worktrack.ai"},
            {"employee_id": "EMP-ENG-003", "full_name": "Miles Dyson",     "email": "miles.dyson@worktrack.ai"},
            {"employee_id": "EMP-ENG-004", "full_name": "Tarissa Dyson",   "email": "tarissa.dyson@worktrack.ai"},
        ],
    },
    {
        "team_name": "Data Science",
        "department": "Technology",
        "manager": {
            "employee_id": "MGR-DAT-001",
            "full_name": "Grace Hopper",
            "email": "grace.hopper@worktrack.ai",
            "role": "manager",
        },
        "new_employees": [
            {"employee_id": "EMP-DAT-001", "full_name": "Alan Turing",     "email": "alan.turing@worktrack.ai"},
            {"employee_id": "EMP-DAT-002", "full_name": "Ada Lovelace",    "email": "ada.lovelace@worktrack.ai"},
            {"employee_id": "EMP-DAT-003", "full_name": "Claude Shannon",  "email": "claude.shannon@worktrack.ai"},
            {"employee_id": "EMP-DAT-004", "full_name": "Norbert Wiener",  "email": "norbert.wiener@worktrack.ai"},
        ],
    },
    {
        "team_name": "Support",
        "department": "Operations",
        "manager": {
            "employee_id": "MGR-SUP-001",
            "full_name": "Linus Torvalds",
            "email": "linus.torvalds@worktrack.ai",
            "role": "manager",
        },
        "new_employees": [
            {"employee_id": "EMP-SUP-001", "full_name": "Guido van Rossum",  "email": "guido.vanrossum@worktrack.ai"},
            {"employee_id": "EMP-SUP-002", "full_name": "Bjarne Stroustrup", "email": "bjarne.stroustrup@worktrack.ai"},
            {"employee_id": "EMP-SUP-003", "full_name": "Dennis Ritchie",    "email": "dennis.ritchie@worktrack.ai"},
            {"employee_id": "EMP-SUP-004", "full_name": "Ken Thompson",      "email": "ken.thompson@worktrack.ai"},
        ],
    },
]

# ── Work item templates ───────────────────────────────────────────────────────

WORK_TEMPLATES = {
    "ticket": [
        ("Fix NLP preprocessing pipeline crash on empty input", 2.0, "done", "high", "TKT-{n}"),
        ("Resolve timeout in chatbot response handler", 1.5, "done", "high", "TKT-{n}"),
        ("Debug intent classification returning wrong label", 3.0, "in_progress", "medium", "TKT-{n}"),
        ("Fix entity extraction missing dates in German locale", 2.5, "done", "medium", "TKT-{n}"),
        ("Patch broken fallback response for unknown intents", 1.0, "done", "low", "TKT-{n}"),
        ("Investigate memory leak in long-running bot sessions", 4.0, "blocked", "high", "TKT-{n}"),
        ("Fix broken CI pipeline on feature branch", 1.5, "done", "high", "TKT-{n}"),
        ("Resolve race condition in async request handler", 2.0, "in_progress", "high", "TKT-{n}"),
        ("Patch security vulnerability in auth middleware", 3.0, "done", "high", "TKT-{n}"),
        ("Fix broken pagination in search results", 1.0, "done", "medium", "TKT-{n}"),
    ],
    "project": [
        ("Implement multi-turn conversation context tracking", 3.5, "in_progress", "high", None),
        ("Design new intent taxonomy for HR domain", 2.0, "done", "medium", None),
        ("Build automated test suite for NLP regression", 4.0, "in_progress", "high", None),
        ("Migrate chatbot config to YAML-based pipeline", 2.5, "done", "medium", None),
        ("Prototype retrieval-augmented generation (RAG) flow", 3.0, "in_progress", "high", None),
        ("Refactor authentication service to use JWT refresh tokens", 3.0, "done", "high", None),
        ("Design data pipeline for user activity aggregation", 2.5, "in_progress", "medium", None),
        ("Implement role-based access control for admin panel", 4.0, "done", "high", None),
        ("Build internal dashboard for model performance metrics", 3.5, "in_progress", "medium", None),
        ("Migrate legacy REST endpoints to GraphQL", 5.0, "planned", "low", None),
    ],
    "meeting": [
        ("Sprint planning — Q2 roadmap", 1.0, "done", None, None),
        ("Weekly team standup", 0.5, "done", None, None),
        ("Stakeholder demo of new FAQ bot", 1.5, "done", None, None),
        ("Architecture review with platform team", 2.0, "done", None, None),
        ("1-on-1 with manager", 0.5, "done", None, None),
        ("Cross-team sync with frontend engineers", 1.0, "done", None, None),
        ("Quarterly OKR review", 2.0, "done", None, None),
        ("Incident post-mortem for prod outage", 1.5, "done", None, None),
    ],
    "review": [
        ("Code review: PR for context window handling", 1.0, "done", None, None),
        ("Review intent training data updates", 1.5, "done", None, None),
        ("Review deployment config for prod release", 0.5, "done", None, None),
        ("Review security audit findings", 2.0, "done", None, None),
        ("Review database migration scripts", 1.0, "done", None, None),
    ],
    "documentation": [
        ("Document chatbot API endpoints for frontend team", 1.5, "done", None, None),
        ("Update README with new environment variables", 0.5, "done", None, None),
        ("Write runbook for bot deployment process", 2.0, "in_progress", None, None),
        ("Document data schema for analytics team", 1.5, "done", None, None),
        ("Update API versioning guidelines", 1.0, "done", None, None),
    ],
    "learning": [
        ("Study LangGraph documentation for agent workflows", 1.5, "done", None, None),
        ("Complete internal LLM fine-tuning workshop", 3.0, "done", None, None),
        ("Read paper: RLHF for dialogue systems", 1.0, "done", None, None),
        ("Watch internal talk: Scaling transformer inference", 1.5, "done", None, None),
        ("Complete SQL performance tuning course", 2.0, "done", None, None),
    ],
    "admin": [
        ("Update sprint board and close completed tickets", 0.5, "done", None, None),
        ("Fill in quarterly skills assessment form", 1.0, "done", None, None),
        ("Respond to cross-team Slack threads", 0.5, "done", None, None),
        ("Prepare weekly status report for manager", 0.5, "done", None, None),
    ],
    "support": [
        ("Help analytics team integrate chatbot event logs", 1.5, "done", None, None),
        ("Assist onboarding new team member with local setup", 1.0, "done", None, None),
        ("Support QA team reproducing regression bug", 1.0, "done", None, None),
        ("Help data team with SQL query optimisation", 1.5, "done", None, None),
    ],
    "polaris_classification": [
        ("Classify 50 user queries into Polaris taxonomy", 2.0, "done", None, None),
        ("Review and correct Polaris labels for edge cases", 1.5, "in_progress", None, None),
        ("Validate Polaris classification output against gold set", 1.0, "done", None, None),
    ],
}

CATEGORY_WEIGHTS = {
    "ticket": 28,
    "project": 22,
    "meeting": 15,
    "review": 10,
    "documentation": 8,
    "learning": 6,
    "admin": 5,
    "support": 4,
    "polaris_classification": 2,
}

ITEMS_PER_DAY = [1, 2, 2, 3, 3, 3, 4]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pick_template(category: str, n: int):
    desc, hours, status, priority, ticket_tmpl = random.choice(WORK_TEMPLATES[category])
    ticket_id = ticket_tmpl.replace("{n}", str(100 + n)) if ticket_tmpl else None
    hours_var = round(max(0.5, hours + random.uniform(-0.5, 0.5)), 1) if hours else None
    return desc, hours_var, status, priority, ticket_id


def _create_log_with_items(db, user: User, work_date: date, counter: int):
    log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        work_date=work_date,
        raw_message=f"Dev seed — {user.full_name} — {work_date}",
        extraction_status="success",
        model_name="dev-seed",
        parse_version="1.0",
    )
    db.add(log)
    db.flush()

    n_items = random.choice(ITEMS_PER_DAY)
    categories = random.choices(
        list(CATEGORY_WEIGHTS.keys()),
        weights=list(CATEGORY_WEIGHTS.values()),
        k=n_items,
    )
    for i, cat in enumerate(categories):
        desc, hours, status, priority, ticket_id = _pick_template(cat, counter + i)
        db.add(WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=work_date,
            task_description=desc,
            work_category=cat,
            hours_spent=hours,
            status=status,
            priority=priority,
            ticket_id=ticket_id,
            confidence_score=round(random.uniform(0.82, 0.99), 2),
            needs_review=False,
            is_user_corrected=False,
        ))


def _seed_history(db, users: list[User], days: int = 30):
    today = date.today()
    counter = 1
    for user in users:
        existing = db.query(WorkLog).filter(WorkLog.user_id == user.id).count()
        if existing > 2:
            logger.info("  %-25s already has %d logs — skipping", user.full_name, existing)
            continue
        logs = 0
        for offset in range(days, 0, -1):
            work_date = today - timedelta(days=offset)
            if work_date.weekday() >= 5:
                continue
            if random.random() > 0.80:
                continue
            _create_log_with_items(db, user, work_date, counter)
            counter += 10
            logs += 1
        db.commit()
        logger.info("  %-25s %d logs created", user.full_name, logs)


def _get_or_create_user(db, data: dict, role: str, team_name: str, department: str,
                        manager_id=None) -> User:
    existing = db.query(User).filter(User.employee_id == data["employee_id"]).first()
    if existing:
        return existing
    user = User(
        employee_id=data["employee_id"],
        full_name=data["full_name"],
        email=data["email"],
        hashed_password=hash_password(DEFAULT_PASSWORD),
        role=role,
        team_name=team_name,
        department=department,
        manager_id=manager_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("  + %-10s %-25s %s", role, user.full_name, user.email)
    return user


# ── Main ──────────────────────────────────────────────────────────────────────

def run(db) -> None:
    random.seed(42)

    all_users: list[User] = []

    for team in TEAMS:
        team_name = team["team_name"]
        department = team["department"]
        logger.info("── Team: %s ──────────────────────────────", team_name)

        # Resolve manager
        if team["manager"] is None:
            # Use existing manager (chandan) for ChatBots
            manager = db.query(User).filter(
                User.role == "manager", User.team_name == team_name
            ).first()
            if not manager:
                logger.warning("  No manager found for %s — skipping", team_name)
                continue
            logger.info("  = manager  %-25s (existing)", manager.full_name)
        else:
            manager = _get_or_create_user(
                db, team["manager"], "manager", team_name, department
            )

        all_users.append(manager)

        # Create employees
        for emp_data in team["new_employees"]:
            emp = _get_or_create_user(
                db, emp_data, "employee", team_name, department, manager_id=manager.id
            )
            all_users.append(emp)

        # Include already-existing employees on this team
        existing_emps = db.query(User).filter(
            User.role == "employee", User.team_name == team_name
        ).all()
        for u in existing_emps:
            if u.id not in {x.id for x in all_users}:
                all_users.append(u)

    logger.info("─" * 50)
    logger.info("Seeding 30 days of work history for %d users...", len(all_users))
    _seed_history(db, all_users, days=30)

    # ── Summary ──
    total_users = db.query(User).count()
    total_logs  = db.query(WorkLog).filter(WorkLog.extraction_status == "success").count()
    total_items = db.query(WorkItem).count()

    logger.info("─" * 50)
    logger.info("Dev seed complete!")
    logger.info("  Users:      %d", total_users)
    logger.info("  Work logs:  %d", total_logs)
    logger.info("  Work items: %d", total_items)
    logger.info("─" * 50)
    logger.info("All NEW accounts use password: %s", DEFAULT_PASSWORD)
    logger.info("─" * 50)
    logger.info("Account summary:")

    for team in TEAMS:
        team_name = team["team_name"]
        logger.info("  [%s]", team_name)
        users = db.query(User).filter(User.team_name == team_name).order_by(User.role.desc()).all()
        for u in users:
            logger.info("    %-10s %-25s %s", u.role, u.full_name, u.email)


if __name__ == "__main__":
    create_tables()
    with SessionLocal() as db:
        run(db)
