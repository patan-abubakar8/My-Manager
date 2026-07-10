"""
Run this once to add new columns to existing tables.
Usage: cd backend_py && python migrate_columns.py
"""
import sys
import os

# Allow running from project root OR backend_py/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text, inspect as sa_inspect
from backend_py.database import engine


MIGRATIONS = [
    ("projects",         "github_url",      "VARCHAR"),
    ("projects",         "github_summary",  "TEXT"),
    ("projects",         "features_json",   "TEXT"),
    ("projects",         "is_own_project",  "BOOLEAN DEFAULT TRUE"),
    ("projects",         "recreate_steps",  "TEXT"),
    ("tailored_resumes", "ats_score",       "INTEGER"),
    ("tailored_resumes", "ats_feedback",    "TEXT"),
    ("tailored_resumes", "ats_keywords",    "TEXT"),
    ("master_profiles",  "raw_text",        "TEXT"),
]


def run():
    inspector = sa_inspect(engine)
    tables = set(inspector.get_table_names())

    for table, col, coltype in MIGRATIONS:
        if table not in tables:
            print(f"  ! Table '{table}' not found — skipping {col}")
            continue
        existing = {c["name"] for c in inspector.get_columns(table)}
        if col in existing:
            print(f"  = {table}.{col} already exists")
        else:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {coltype}"))
            print(f"  + Added {table}.{col} ({coltype})")

    print("\nMigration complete!")


if __name__ == "__main__":
    run()
