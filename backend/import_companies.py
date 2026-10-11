"""Bulk-import companies from a CSV file (only companies that agreed to be listed / whose data you are entitled to use).

    python import_companies.py companies.csv                  # imported as PENDING (review in Admin > Companies)
    python import_companies.py companies.csv --approve        # imported as APPROVED (live on the site)
    python import_companies.py companies.csv --products products.csv

Run  python migrate_catalog.py  and  python seed_catalog.py  once before importing specialities / product categories.

companies.csv columns (header row required; only name and business_type are mandatory):
    name, business_type, state, city, email, phone, address, description, owner_name,
    specialities, product_categories, capability_notes, categories
  - business_type: Manufacturer | Third Party Manufacturer | PCD Franchise Company | Distributor | Wholesaler
  - specialities / product_categories: names from the master lists, separated by ;   (a , also works)
    Names that are not in the master lists are NOT created: they are reported at the end so you can add them
    in Admin > Catalogue first or correct the file.
  - Every speciality / product category is saved as UNVERIFIED with capability_notes as the note.
    Nothing is ever imported as Verified; an admin verifies each claim with evidence.
  - email: optional. A blank email creates an UNCLAIMED listing with a placeholder login that cannot receive mail.
    Give the company a real email later (or let it register) when you want it to manage its own profile.
  - categories: the OLD simple categories (Derma, Pediatric ...), kept for backward compatibility.
products.csv columns (optional): company_email, company_name, name, composition, dosage_form, pack_size
  (match a company by company_email, or by company_name when it had no email)

Writes imported_logins.csv with a login (email + temporary password) per new company. Hand these to companies that
have a real email, then delete the file. Re-running skips companies that already exist (matched by email or name).
"""
import argparse, csv, re, secrets
from sqlalchemy import func, select
from app.db.base import SessionLocal
from app.models import (ActiveStatus, Category, Company, CompanyProductCapability, CompanySpeciality, CompanyStatus,
                        Location, LocationType, Product, ProductCategory, ProductStatus, Role, Speciality, User,
                        VerificationStatus)
from app.core.security import hash_password
from app.services.slugs import slugify, unique_slug

TYPES = {"Manufacturer", "Third Party Manufacturer", "PCD Franchise Company", "Distributor", "Wholesaler"}
PLACEHOLDER_DOMAIN = "unclaimed.pharmaconnect.invalid"


def split_list(v: str) -> list[str]:
    parts = v.split(";") if ";" in v else v.split(",")
    return [p.strip() for p in parts if p.strip()]


def first_phone(v: str) -> str:
    """Phone columns hold one number (max 20 chars). Ranges like '01795-228501–03' or 'a / b' keep the first number."""
    v = re.split(r"\s*(?:/|;|,|\bor\b)\s*", v.strip())[0]
    v = re.sub(r"[–—-]\d{1,3}$", "", v)  # '228501–03' -> '228501'
    return v.strip()


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
    unknown = {"speciality": {}, "product category": {}, "old category": {}}
    n_spec = n_cap = 0
    with SessionLocal() as db:
        old_cats = {c.name.lower(): c for c in db.scalars(select(Category)).all()}
        specs = {s.name.lower(): s for s in db.scalars(select(Speciality).where(Speciality.is_active))}
        pcats = {c.name.lower(): c for c in db.scalars(select(ProductCategory).where(ProductCategory.is_active))}
        by_email, by_name = {}, {}
        with open(a.companies_csv, newline="", encoding="utf-8-sig") as f:
            for n, row in enumerate(csv.DictReader(f), start=2):
                row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                if not any(row.values()): continue  # blank line
                name = row.get("name", "")
                if not name:
                    errors.append(f"row {n}: name is required"); continue
                if row.get("business_type") not in TYPES:
                    errors.append(f"row {n} ({name}): business_type must be one of {sorted(TYPES)}"); continue
                email = row.get("email", "").lower()
                if email and "@" not in email:
                    errors.append(f"row {n} ({name}): invalid email '{email}'"); continue
                placeholder = not email
                login = email or f"{slugify(name)}@{PLACEHOLDER_DOMAIN}"
                existing = db.scalar(select(Company).join(User, User.id == Company.user_id).where(User.email == login)) if login else None
                if not existing and placeholder:
                    existing = db.scalar(select(Company).where(func.lower(Company.name) == name.lower()))
                if existing:
                    skipped += 1; by_email[login] = by_name[name.lower()] = existing; continue
                phone = first_phone(row.get("phone", ""))
                if len(phone) > 20:
                    errors.append(f"row {n} ({name}): phone '{phone}' is longer than 20 characters, left blank"); phone = ""
                st = find_loc(db, row["state"], LocationType.STATE) if row.get("state") else None
                ct = find_loc(db, row["city"], LocationType.CITY, st.id if st else None) if row.get("city") and st else None
                pw = secrets.token_urlsafe(9)
                user = User(name=row.get("owner_name") or name, email=login, mobile=phone or "-",
                            password_hash=hash_password(pw), role=Role.SUPPLIER)
                db.add(user); db.flush()
                comp = Company(user_id=user.id, name=name, slug=unique_slug(db, Company, f"{name}-{row.get('city', '')}"),
                               business_type=row["business_type"], description=row.get("description") or None,
                               address=row.get("address") or None, phone=phone or None, email=None if placeholder else email,
                               city_id=ct.id if ct else None, state_id=st.id if st else None, status=status)
                for cn in split_list(row.get("categories", "")):
                    if cn.lower() in old_cats: comp.categories.append(old_cats[cn.lower()])
                    else: unknown["old category"].setdefault(cn, []).append(name)
                db.add(comp); db.flush()
                note = row.get("capability_notes") or "Imported from CSV. Needs verification."
                for sn in split_list(row.get("specialities", "")):
                    s = specs.get(sn.lower())
                    if not s: unknown["speciality"].setdefault(sn, []).append(name); continue
                    db.add(CompanySpeciality(company_id=comp.id, speciality_id=s.id, verification_status=VerificationStatus.UNVERIFIED, notes=note)); n_spec += 1
                seen = set()
                for cn in split_list(row.get("product_categories", "")):
                    c = pcats.get(cn.lower())
                    if not c: unknown["product category"].setdefault(cn, []).append(name); continue
                    if c.id in seen: continue
                    seen.add(c.id)
                    db.add(CompanyProductCapability(company_id=comp.id, product_category_id=c.id, verification_status=VerificationStatus.UNVERIFIED, notes=note)); n_cap += 1
                by_email[login] = by_name[name.lower()] = comp
                logins.append((name, login, pw, "unclaimed (placeholder email)" if placeholder else "")); made += 1
        pcount = 0
        if a.products:
            with open(a.products, newline="", encoding="utf-8-sig") as f:
                for n, row in enumerate(csv.DictReader(f), start=2):
                    row = {k.strip(): (v or "").strip() for k, v in row.items() if k}
                    comp = by_email.get(row.get("company_email", "").lower()) or by_name.get(row.get("company_name", "").lower())
                    if not comp or not row.get("name"):
                        errors.append(f"products row {n}: unknown company or missing name"); continue
                    if db.scalar(select(Product.id).where(Product.company_id == comp.id, Product.name == row["name"])): continue
                    db.add(Product(company_id=comp.id, name=row["name"], slug=unique_slug(db, Product, f"{row['name']}-{comp.name}")[:240],
                                   composition=row.get("composition") or None, dosage_form=row.get("dosage_form") or None,
                                   pack_size=row.get("pack_size") or None,
                                   status=ProductStatus.APPROVED if a.approve else ProductStatus.PENDING))
                    pcount += 1
        db.commit()
    if logins:
        with open("imported_logins.csv", "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["company", "login_email", "temporary_password", "note"]); w.writerows(logins)
    print(f"Imported {made} companies ({status.value}), {n_spec} speciality claims and {n_cap} product-category claims "
          f"(all Unverified), {pcount} products. Skipped {skipped} existing.")
    if logins: print("Logins written to imported_logins.csv. Share them only with companies that have a real email, then delete the file.")
    for kind, d in unknown.items():
        for nm, cos in d.items(): print(f"  ! {kind} not in the master list, skipped: '{nm}' ({', '.join(cos)})")
    for e in errors: print("  !", e)


if __name__ == "__main__":
    main()
