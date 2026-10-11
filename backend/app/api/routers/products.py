from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import Company, CompanyStatus, Location, Product, ProductStatus

router = APIRouter(prefix="/api/products", tags=["products"])
# Public visibility rule: product APPROVED and its company APPROVED.
_public = (Product.status == ProductStatus.APPROVED, Company.status == CompanyStatus.APPROVED)

def _card(p: Product, c: Company, names: dict) -> dict:
    return {"id": p.id, "name": p.name, "slug": p.slug, "composition": p.composition, "dosage_form": p.dosage_form,
            "pack_size": p.pack_size, "image_url": p.image_url, "company_name": c.name, "company_slug": c.slug,
            "city": names.get(c.city_id), "state": names.get(c.state_id)}

def _key():
    # Same product = same name, ignoring case and surrounding spaces.
    return func.lower(func.trim(Product.name))

@router.get("")
def list_products(q: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=50),
                  db: Session = Depends(get_db)):
    """One row per distinct product name, with how many approved suppliers offer it."""
    f = list(_public)
    if q:
        like = f"%{q}%"
        f.append(or_(Product.name.ilike(like), Product.composition.ilike(like), Company.name.ilike(like)))
    k = _key()
    grouped = (select(k.label("key"), func.min(Product.name).label("name"), func.min(Product.composition).label("composition"),
                      func.min(Product.dosage_form).label("dosage_form"), func.max(Product.image_url).label("image_url"),
                      func.count(func.distinct(Product.company_id)).label("suppliers"))
               .join(Company, Company.id == Product.company_id).where(*f).group_by(k))
    total = db.scalar(select(func.count()).select_from(grouped.subquery())) or 0
    rows = db.execute(grouped.order_by(func.min(Product.name)).offset((page - 1) * page_size).limit(page_size)).all()
    items = [{"key": r.key, "name": r.name, "composition": r.composition, "dosage_form": r.dosage_form,
              "image_url": r.image_url, "suppliers": r.suppliers} for r in rows]
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@router.get("/compare")
def compare_product(name: str, db: Session = Depends(get_db)):
    """Every approved supplier of one product, side by side."""
    key = name.strip().lower()
    rows = db.execute(select(Product, Company).join(Company, Company.id == Product.company_id)
                      .where(_key() == key, *_public).order_by(Company.name)).all()
    if not rows:
        raise HTTPException(404, "Product not found")
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    first = rows[0][0]
    return {"name": first.name, "composition": first.composition, "dosage_form": first.dosage_form,
            "suppliers": [{**_card(p, c, names), "business_type": c.business_type} for p, c in rows]}

@router.get("/{slug}")
def get_product(slug: str, db: Session = Depends(get_db)):
    row = db.execute(select(Product, Company).join(Company, Company.id == Product.company_id)
                     .where(Product.slug == slug, *_public)).first()
    if not row:
        raise HTTPException(404, "Product not found")
    p, c = row
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    related = db.execute(select(Product, Company).join(Company, Company.id == Product.company_id)
                         .where(Product.company_id == c.id, Product.id != p.id, *_public).limit(4)).all()
    return {**_card(p, c, names), "description": p.description, "related": [_card(x, y, names) for x, y in related]}
