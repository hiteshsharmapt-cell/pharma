from fastapi import APIRouter, Depends, HTTPException
import re, secrets
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.core.security import hash_password
from app.db.base import get_db
from app.models import (Company, CompanyStatus, Lead, Location, Product, ProductStatus, Requirement,
                        RequirementStatus, Role, User)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

class StatusIn(BaseModel):
    status: CompanyStatus

PLACEHOLDER_DOMAIN = "unclaimed.pharmaconnect.invalid"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _is_placeholder(email: str | None) -> bool:
    return bool(email) and email.lower().endswith("@" + PLACEHOLDER_DOMAIN)

def _supplier_owner(db: Session, company: Company) -> User:
    owner = db.get(User, company.user_id)
    if not owner or owner.role != Role.SUPPLIER:  # never touch an admin/buyer account
        raise HTTPException(400, "This company's login is not a supplier account")
    return owner

def _email_state(company: Company, owner: User) -> dict:
    real = not _is_placeholder(owner.email)
    return {"company_id": company.id, "name": company.name, "has_email": real,
            "email": owner.email if real else None, "login_email": owner.email}

class EmailIn(BaseModel):
    email: str = Field(max_length=254)
    reset_password: bool = False  # True -> generate a new temporary password, shown once

@router.get("/companies/{company_id}/email")
def get_company_email(company_id: int, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    return _email_state(company, _supplier_owner(db, company))

@router.put("/companies/{company_id}/email")
def set_company_email(company_id: int, data: EmailIn, db: Session = Depends(get_db)):
    """Add or change the company's login/contact email. Optionally issues a new temporary password (returned once)."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    owner = _supplier_owner(db, company)
    email = data.email.strip().lower()
    if not _EMAIL_RE.match(email) or _is_placeholder(email):
        raise HTTPException(422, "Enter a valid email address")
    clash = db.scalar(select(User.id).where(func.lower(User.email) == email, User.id != owner.id))
    if clash:
        raise HTTPException(409, "This email is already used by another account")
    was_placeholder = _is_placeholder(owner.email)
    owner.email = email
    company.email = email
    temp = None
    if data.reset_password or was_placeholder:  # a placeholder account has an unknown password: issue one
        temp = secrets.token_urlsafe(9)
        owner.password_hash = hash_password(temp)
    db.commit()
    return {**_email_state(company, owner), "temporary_password": temp}

@router.delete("/companies/{company_id}/email")
def delete_company_email(company_id: int, db: Session = Depends(get_db)):
    """Remove the real email: login reverts to an unusable placeholder, the contact email is cleared, and the
    old password stops working. The company stays listed."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    owner = _supplier_owner(db, company)
    slug = re.sub(r"[^a-z0-9]+", "-", company.slug.lower()).strip("-") or f"company-{company.id}"
    placeholder = f"{slug}@{PLACEHOLDER_DOMAIN}"
    if db.scalar(select(User.id).where(User.email == placeholder, User.id != owner.id)):
        placeholder = f"{slug}-{company.id}@{PLACEHOLDER_DOMAIN}"
    owner.email = placeholder
    owner.password_hash = hash_password(secrets.token_urlsafe(24))  # nobody knows it: login disabled
    company.email = None
    db.commit()
    return _email_state(company, owner)

@router.get("/companies")
def list_companies(status: CompanyStatus | None = None, q: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Company, User).join(User, User.id == Company.user_id).order_by(Company.created_at.desc())
    if status:
        stmt = stmt.where(Company.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Company.name.ilike(like), User.email.ilike(like)))
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    return [{"id": c.id, "name": c.name, "slug": c.slug, "business_type": c.business_type,
             "city": names.get(c.city_id), "state": names.get(c.state_id),
             "owner_name": u.name, "owner_email": u.email, "owner_mobile": u.mobile,
             "has_email": not _is_placeholder(u.email),
             "status": c.status.value, "featured_rank": c.featured_rank, "created_at": c.created_at} for c, u in db.execute(stmt).all()]

@router.patch("/companies/{company_id}/status")
def set_company_status(company_id: int, data: StatusIn, db: Session = Depends(get_db)):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    company.status = data.status
    db.commit()
    return {"id": company.id, "status": company.status.value}


@router.delete("/companies/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    """Permanently remove a company: its products, its leads and its supplier login. Cannot be undone."""
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    leads = db.scalars(select(Lead).where(Lead.supplier_id == company.id)).all()
    req_ids = {l.requirement_id for l in leads}
    for l in leads:
        db.delete(l)
    db.flush()
    for rid in req_ids:  # a requirement left with no leads returns to the unassigned queue
        if not db.scalar(select(Lead.id).where(Lead.requirement_id == rid).limit(1)):
            r = db.get(Requirement, rid)
            if r and r.status == RequirementStatus.ASSIGNED:
                r.status = RequirementStatus.NEW
    owner = db.get(User, company.user_id)
    name = company.name
    db.delete(company)  # products cascade
    db.flush()
    if owner and owner.role == Role.SUPPLIER:  # never touches an admin or buyer account
        db.delete(owner)
    db.commit()
    return {"ok": True, "deleted": name, "leads_removed": len(leads)}


class ProductStatusIn(BaseModel):
    status: ProductStatus

@router.get("/products")
def list_products(status: ProductStatus | None = None, db: Session = Depends(get_db)):
    stmt = select(Product, Company).join(Company, Company.id == Product.company_id).order_by(Product.created_at.desc())
    if status:
        stmt = stmt.where(Product.status == status)
    return [{"id": p.id, "name": p.name, "composition": p.composition, "dosage_form": p.dosage_form,
             "pack_size": p.pack_size, "company": c.name, "company_status": c.status.value,
             "status": p.status.value} for p, c in db.execute(stmt).all()]

@router.patch("/products/{product_id}/status")
def set_product_status(product_id: int, data: ProductStatusIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    product.status = data.status
    db.commit()
    return {"id": product.id, "status": product.status.value}


MAX_FEATURED = 12

class FeaturedIn(BaseModel):
    company_ids: list[int] = Field(default_factory=list, max_length=MAX_FEATURED)  # in display order; first 5 = Top 5

@router.get("/featured")
def get_featured(db: Session = Depends(get_db)):
    rows = db.scalars(select(Company).where(Company.featured_rank.is_not(None)).order_by(Company.featured_rank)).all()
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    return [{"id": c.id, "name": c.name, "city": names.get(c.city_id), "state": names.get(c.state_id),
             "status": c.status.value, "featured_rank": c.featured_rank} for c in rows]

@router.put("/featured")
def set_featured(data: FeaturedIn, db: Session = Depends(get_db)):
    """Replace the whole featured list. The position in company_ids becomes the rank (1 = first)."""
    ids = list(dict.fromkeys(data.company_ids))
    found = {c.id: c for c in db.scalars(select(Company).where(Company.id.in_(ids))).all()} if ids else {}
    missing = [i for i in ids if i not in found]
    if missing:
        raise HTTPException(404, f"Company not found: {missing}")
    for c in db.scalars(select(Company).where(Company.featured_rank.is_not(None))).all():
        c.featured_rank = None
    for pos, cid in enumerate(ids, start=1):
        found[cid].featured_rank = pos
    db.commit()
    return {"ok": True, "count": len(ids)}
