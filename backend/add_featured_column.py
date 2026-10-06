"""One-time: adds companies.featured_rank to an existing database. Safe to run twice.
    python add_featured_column.py
"""
from sqlalchemy import inspect, text
from app.db.base import engine

with engine.begin() as conn:
    cols = [c["name"] for c in inspect(conn).get_columns("companies")]
    if "featured_rank" in cols:
        print("featured_rank already exists - nothing to do.")
    else:
        conn.execute(text("ALTER TABLE companies ADD COLUMN featured_rank INTEGER"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_companies_featured_rank ON companies (featured_rank)"))
        print("Added companies.featured_rank.")
