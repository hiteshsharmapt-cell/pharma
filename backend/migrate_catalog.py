"""Creates the catalogue tables if they do not exist yet. Existing tables and data are never touched.
Safe to run any number of times:   python migrate_catalog.py
"""
from sqlalchemy import inspect
from app.db.base import Base, engine
import app.models  # noqa: F401  (registers every table, including the catalogue)

NEW = ["specialities", "dosage_form_groups", "formulation_types", "catalog_product_categories",
       "product_category_specialities", "company_specialities", "company_product_capabilities",
       "capability_formulation_types"]

before = set(inspect(engine).get_table_names())
Base.metadata.create_all(engine)   # only creates tables that are missing
after = set(inspect(engine).get_table_names())
created = [t for t in NEW if t in after and t not in before]
print("Created:", ", ".join(created) if created else "nothing (all catalogue tables already exist)")
missing = [t for t in NEW if t not in after]
if missing:
    raise SystemExit(f"Missing tables after migration: {missing}")
