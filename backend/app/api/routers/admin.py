from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.db.base import get_db
from app.models import Company, CompanyStatus, Location, Product, ProductStatus, User

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
