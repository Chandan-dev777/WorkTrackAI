"""Apply schema migrations to production PostgreSQL using personal credentials.

The app IAM user (db_MbCaBw-1cf05322) cannot ALTER tables it doesn't own.
Run this script with your personal token (Get Credentials in DBaaS console).

Usage:
  DBAAS_AUTH_TOKEN="<paste token>" .venv/bin/python migrate_prod.py
"""

import os
import sys
import psycopg2

DB_HOST = "ec1-dbaas-rds-aurora.cluster-cjk5epdyjney.eu-central-1.rds.amazonaws.com"
DB_PORT = 5432
DB_NAME = "db_MbCaBw"
DB_USER = "db_MbCaBw-X288712"   # personal user — owns the tables

MIGRATIONS = [
    # (table, column, sql)
    ("work_items", "logical_task_id",
     "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS logical_task_id VARCHAR(36)"),
    ("work_items", "continuation_of",
     "ALTER TABLE work_items ADD COLUMN IF NOT EXISTS continuation_of VARCHAR(36)"),
    ("users", "onboarding_complete",
     "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE NOT NULL"),
    ("users", "hashed_password_nullable",
     "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"),
]


def main():
    token = os.getenv("DBAAS_AUTH_TOKEN")
    if not token:
        print("ERROR: Set DBAAS_AUTH_TOKEN env var first.")
        print('  DBAAS_AUTH_TOKEN="<paste from DBaaS console>" .venv/bin/python migrate_prod.py')
        sys.exit(1)

    print(f"Connecting as {DB_USER}...")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=token, sslmode="require",
    )
    conn.autocommit = False
    cur = conn.cursor()

    for table, label, sql in MIGRATIONS:
        try:
            cur.execute(sql)
            conn.commit()
            print(f"  ✓ {label}")
        except Exception as e:
            conn.rollback()
            print(f"  ✗ {label}: {e}")

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
