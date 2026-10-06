from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import Company, CompanyStatus, Location, Product, ProductStatus

router = APIRouter(prefix="/api/companies", tags=["companies"])

def _card(c: Company, names: dict) -> dict:
    return {"id": c.id, "name": c.name, "slug": c.slug, "description": c.description, "logo_url": c.logo_url,
            "business_type": c.business_type, "city": names.get(c.city_id), "state": names.get(c.state_id),
            "categories": [x.name for x in c.categories], "featured_rank": c.featured_rank}

@router.get("")
def list_companies(q: str | None = None, state_id: int | None = None, city_id: int | None = None,
                   business_type: str | None = None, page: int = Query(1, ge=1),
                   page_size: int = Query(12, ge=1, le=50), db: Session = Depends(get_db)):
    f = [Company.status == CompanyStatus.APPROVED]  # only approved companies are ever public
    if q: f.append(or_(Company.name.ilike(f"%{q}%"), Company.description.ilike(f"%{q}%")))
    if state_id: f.append(Company.state_id == state_id)
    if city_id: f.append(Company.city_id == city_id)
    if business_type: f.append(Company.business_type == business_type)
    total = db.scalar(select(func.count()).select_from(Company).where(*f)) or 0
    rows = db.scalars(select(Company).where(*f).order_by(Company.name).offset((page - 1) * page_size).limit(page_size)).all()
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    return {"items": [_card(c, names) for c in rows], "total": total, "page": page, "page_size": page_size}

@router.get("/featured")
def featured_companies(db: Session = Depends(get_db)):
    """Homepage companies, in the order the admin chose. Ranks 1-5 are highlighted by the frontend."""
    rows = db.scalars(select(Company).where(Company.status == CompanyStatus.APPROVED, Company.featured_rank.is_not(None))
                      .order_by(Company.featured_rank, Company.name).limit(12)).all()
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    return {"items": [_card(c, names) for c in rows]}

@router.get("/{slug}")
def get_company(slug: str, db: Session = Depends(get_db)):
    c = db.scalar(select(Company).where(Company.slug == slug, Company.status == CompanyStatus.APPROVED))
    if not c:
        raise HTTPException(404, "Company not found")
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    products = db.scalars(select(Product).where(Product.company_id == c.id, Product.status == ProductStatus.APPROVED)).all()
    return {**_card(c, names), "address": c.address, "brochure_url": c.brochure_url,
            "products": [{"name": p.name, "slug": p.slug, "composition": p.composition,
                          "dosage_form": p.dosage_form, "pack_size": p.pack_size} for p in products]}
