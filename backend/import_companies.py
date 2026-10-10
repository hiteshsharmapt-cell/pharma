"""Bulk-import REAL companies from a CSV file (only companies that agreed to be listed).

    python import_companies.py companies.csv                       # imported as PENDING (review in Admin > Companies)
    python import_companies.py companies.csv --approve             # imported as APPROVED (live on the site)
    python import_companies.py companies.csv --products products.csv --approve

companies.csv columns (header row required):
    name, business_type, state, city, email, phone, address, description, categories, owner_name
  - business_type: Manufacturer | Third Party Manufacturer | PCD Franchise Company | Distributor | Wholesaler
  - categories: names separated by ;   e.g.  Derma;Pediatric   (must match existing category names)
  - email must be unique; it becomes the company's supplier login.
products.csv columns (optional): company_email, name, composition, dosage_form, pack_size

Writes imported_logins.csv with a login (email + temporary password) per new company - hand these over
to each company, then delete the file. Re-running skips companies whose email already exists.
"""
import argparse, csv, secrets
from sqlalchemy import func, select
from app.db.base import SessionLocal
from app.models import (ActiveStatus, Category, Company, CompanyStatus, Location, LocationType, Product,
                        ProductStatus, Role, User)
from app.core.security import hash_password
from app.services.slugs import slugify, unique_slug

TYPES = {"Manufacturer", "Third Party Manufacturer", "PCD Franchise Company", "Distributor", "Wholesaler"}


def find_loc(db, name, kind, parent_id=None):
    q = select(Location).where(func.lower(Location.name) == name.strip().lower(), Location.type == kind)
    if parent_id: q = q.where(Location.parent_id == parent_id)
    loc = db.scalars(q).first()
    if loc: return loc
    loc = Location(name=name.strip(), slug=unique_slug(db, Location, f"{name}-{parent_id or ''}"), type=kind,
                   parent_id=parent_id, status=ActiveStatus.ACTIVE)
    db.add(loc); db.flush(); return loc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("companies_csv"); ap.add_argument("--products"); ap.add_argument("--approve", action="store_true")
    a = ap.parse_args()
    status = CompanyStatus.APPROVED if a.approve else CompanyStatus.PENDING
    made, skipped, errors, logins = 0, 0, [], []
    with SessionLocal() as db:
        cats = {c.name.lower(): c for c in db.scalars(select(Category)).all()}
        by_email = {}
        with open(a.companies_csv, newline="", encoding="utf-8-sig") as f:
            for n, row in enumerate(csv.DictReader(f), start=2):
                row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                email = row.get("email", "").lower()
                if not row.get("name") or not email or "@" not in email:
                    errors.append(f"row {n}: name and a valid email are required"); continue
                if row.get("business_type") not in TYPES:
                    errors.append(f"row {n} ({row['name']}): business_type must be one of {sorted(TYPES)}"); continue
                if db.scalar(select(User.id).where(User.email == email)):
                    skipped += 1; by_email[email] = db.scalar(select(Company).join(User).where(User.email == email)); continue
                st = find_loc(db, row["state"], LocationType.STATE) if row.get("state") else None
                ct = find_loc(db, row["city"], LocationType.CITY, st.id if st else None) if row.get("city") and st else None
                pw = secrets.token_urlsafe(9)
                user = User(name=row.get("owner_name") or row["name"], email=email, mobile=row.get("phone") or "-",
                            password_hash=hash_password(pw), role=Role.SUPPLIER)
                db.add(user); db.flush()
                comp = Company(user_id=user.id, name=row["name"], slug=unique_slug(db, Company, f"{row['name']}-{row.get('city', '')}"),
                               business_type=row["business_type"], description=row.get("description") or None,
                               address=row.get("address") or None, phone=row.get("phone") or None, email=email,
                               city_id=ct.id if ct else None, state_id=st.id if st else None, status=status)
                missing = []
                for cn in [x.strip() for x in row.get("categories", "").split(";") if x.strip()]:
                    (comp.categories.append(cats[cn.lower()]) if cn.lower() in cats else missing.append(cn))
                if missing: errors.append(f"row {n} ({row['name']}): unknown categories ignored: {missing}")
                db.add(comp); db.flush(); by_email[email] = comp
                logins.append((row["name"], email, pw)); made += 1
        pcount = 0
        if a.products:
            with open(a.products, newline="", encoding="utf-8-sig") as f:
                for n, row in enumerate(csv.DictReader(f), start=2):
                    row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                    comp = by_email.get(row.get("company_email", "").lower())
                    if not comp or not row.get("name"):
                        errors.append(f"products row {n}: unknown company_email or missing name"); continue
                    if db.scalar(select(Product.id).where(Product.company_id == comp.id, Product.name == row["name"])): continue
                    db.add(Product(company_id=comp.id, name=row["name"], slug=unique_slug(db, Product, f"{row['name']}-{comp.name}")[:240],
                                   composition=row.get("composition") or None, dosage_form=row.get("dosage_form") or None,
                                   pack_size=row.get("pack_size") or None,
                                   status=ProductStatus.APPROVED if a.approve else ProductStatus.PENDING))
                    pcount += 1
        db.commit()
    if logins:
        with open("imported_logins.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["company", "login_email", "temporary_password"]); w.writerows(logins)
    print(f"Imported {made} companies ({status.value}), {pcount} products, skipped {skipped} existing.")
    if logins: print("Logins written to imported_logins.csv - share them with each company, then delete the file.")
    for e in errors: print("  !", e)


if __name__ == "__main__":
    main()
