from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.db.base import get_db
from app.models import (Company, CompanyStatus, Lead, Location, Product, ProductStatus, Requirement,
                        RequirementStatus, Role, User)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

class StatusIn(BaseModel):
    status: CompanyStatus

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
