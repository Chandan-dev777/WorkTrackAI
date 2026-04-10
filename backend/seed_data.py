"""
Seed script — Phase 1: users and teams only.

Creates 3 managers + 12 employees across Engineering, Data, and Support teams.
No work logs are created here; those are seeded in Phase 5.

Usage:
    python -m backend.seed_data
"""

import logging

from backend.database import SessionLocal, create_tables
from backend.models.user import User
from backend.services.auth_service import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


TEAMS = [
    {
        "manager": {
            "employee_id": "MGR-ENG-001",
            "full_name": "Sarah Connor",
            "email": "sarah.connor@worktrack.ai",
            "role": "manager",
            "team_name": "Engineering",
            "department": "Technology",
        },
        "members": [
            {"employee_id": "EMP-ENG-001", "full_name": "John Reese",      "email": "john.reese@worktrack.ai"},
            {"employee_id": "EMP-ENG-002", "full_name": "Kate Brewster",   "email": "kate.brewster@worktrack.ai"},
            {"employee_id": "EMP-ENG-003", "full_name": "Miles Dyson",     "email": "miles.dyson@worktrack.ai"},
            {"employee_id": "EMP-ENG-004", "full_name": "Tarissa Dyson",   "email": "tarissa.dyson@worktrack.ai"},
        ],
    },
    {
        "manager": {
            "employee_id": "MGR-DAT-001",
            "full_name": "Grace Hopper",
            "email": "grace.hopper@worktrack.ai",
            "role": "manager",
            "team_name": "Data",
            "department": "Technology",
        },
        "members": [
            {"employee_id": "EMP-DAT-001", "full_name": "Alan Turing",     "email": "alan.turing@worktrack.ai"},
            {"employee_id": "EMP-DAT-002", "full_name": "Ada Lovelace",    "email": "ada.lovelace@worktrack.ai"},
            {"employee_id": "EMP-DAT-003", "full_name": "Claude Shannon",  "email": "claude.shannon@worktrack.ai"},
            {"employee_id": "EMP-DAT-004", "full_name": "Norbert Wiener",  "email": "norbert.wiener@worktrack.ai"},
        ],
    },
    {
        "manager": {
            "employee_id": "MGR-SUP-001",
            "full_name": "Linus Torvalds",
            "email": "linus.torvalds@worktrack.ai",
            "role": "manager",
            "team_name": "Support",
            "department": "Operations",
        },
        "members": [
            {"employee_id": "EMP-SUP-001", "full_name": "Guido van Rossum", "email": "guido.vanrossum@worktrack.ai"},
            {"employee_id": "EMP-SUP-002", "full_name": "Bjarne Stroustrup","email": "bjarne.stroustrup@worktrack.ai"},
            {"employee_id": "EMP-SUP-003", "full_name": "Dennis Ritchie",   "email": "dennis.ritchie@worktrack.ai"},
            {"employee_id": "EMP-SUP-004", "full_name": "Ken Thompson",     "email": "ken.thompson@worktrack.ai"},
        ],
    },
]

ADMIN_USER = {
    "employee_id": "ADMIN-001",
    "full_name": "System Admin",
    "email": "admin@worktrack.ai",
    "role": "admin",
    "team_name": None,
    "department": None,
}

DEFAULT_PASSWORD = "WorkTrack2026!"


def seed(db) -> None:
    existing = db.query(User).count()
    if existing > 0:
        logger.info("Database already has %d users — skipping seed.", existing)
        return

    created = 0

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
    created += 1
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
        created += 1
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
            created += 1
            logger.info("Created employee: %s", member.email)

    db.commit()
    logger.info("Seed complete — %d users created. Default password: %s", created, DEFAULT_PASSWORD)


if __name__ == "__main__":
    create_tables()
    with SessionLocal() as db:
        seed(db)
