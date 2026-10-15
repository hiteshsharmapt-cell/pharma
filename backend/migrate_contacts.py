"""Creates the contacts table if it does not exist yet. Nothing existing is touched; safe to run repeatedly:
    python migrate_contacts.py
"""
from sqlalchemy import inspect
from app.db.base import Base, engine
import app.models  # noqa: F401

had = "contacts" in inspect(engine).get_table_names()
Base.metadata.create_all(engine)
print("contacts table already exists" if had else "Created: contacts")
