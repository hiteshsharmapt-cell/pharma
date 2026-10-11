from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import (Company, CompanyProductCapability as Cap, CompanySpeciality as CompSpec, CompanyStatus,
                        Location, Product, ProductCategory, ProductStatus, Speciality, VerificationStatus,
                        capability_formulation_types as cft)
from app.services.catalog import expand_categories, visible_statuses

router = APIRouter(prefix="/api/companies", tags=["companies"])

def _card(c: Company, names: dict) -> dict:
    return {"id": c.id, "name": c.name, "slug": c.slug, "description": c.description, "logo_url": c.logo_url,
            "business_type": c.business_type, "city": names.get(c.city_id), "state": names.get(c.state_id),
            "categories": [x.name for x in c.categories], "featured_rank": c.featured_rank}

@router.get("")
def list_companies(q: str | None = None, state_id: int | None = None, city_id: int | None = None,
                   business_type: str | None = None,
                   speciality_id: list[int] | None = Query(None), dosage_form_group_id: list[int] | None = Query(None),
                   product_category_id: list[int] | None = Query(None), formulation_type_id: list[int] | None = Query(None),
                   include_unverified: bool = False, page: int = Query(1, ge=1),
                   page_size: int = Query(12, ge=1, le=50), db: Session = Depends(get_db)):
    """Public company search. Speciality and manufacturing-capability filters are independent and can be combined.
    Only VERIFIED claims match unless include_unverified is set. Filters are real joins (EXISTS), so a company
    appears once however many of its categories match."""
    f = [Company.status == CompanyStatus.APPROVED]  # only approved companies are ever public
    if q: f.append(or_(Company.name.ilike(f"%{q}%"), Company.description.ilike(f"%{q}%")))
    if state_id: f.append(Company.state_id == state_id)
    if city_id: f.append(Company.city_id == city_id)
    if business_type: f.append(Company.business_type == business_type)
    ok = visible_statuses(include_unverified)
    if speciality_id:
        f.append(exists().where(CompSpec.company_id == Company.id, CompSpec.speciality_id.in_(speciality_id),
                                CompSpec.verification_status.in_(ok)))
    cap = []  # all capability conditions must hold on the SAME capability row (e.g. Eye Drops AND Solution)
    if product_category_id:
        cap.append(Cap.product_category_id.in_(expand_categories(db, product_category_id) or {-1}))
    if dosage_form_group_id:
        cap.append(Cap.product_category_id.in_(select(ProductCategory.id).where(
            ProductCategory.dosage_form_group_id.in_(dosage_form_group_id), ProductCategory.is_active)))
    if formulation_type_id:
        cap.append(Cap.id.in_(select(cft.c.capability_id).where(cft.c.formulation_type_id.in_(formulation_type_id))))
    if cap:
        f.append(exists().where(Cap.company_id == Company.id, Cap.verification_status.in_(ok), *cap))
    total = db.scalar(select(func.count()).select_from(Company).where(*f)) or 0
    rows = db.scalars(select(Company).where(*f).order_by(Company.name).offset((page - 1) * page_size).limit(page_size)).all()
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    specs: dict[int, list[str]] = {}
    if rows:
        for cid, sname in db.execute(select(CompSpec.company_id, Speciality.name)
                                     .join(Speciality, Speciality.id == CompSpec.speciality_id)
                                     .where(CompSpec.company_id.in_([c.id for c in rows]), Speciality.is_active,
                                            CompSpec.verification_status == VerificationStatus.VERIFIED)
                                     .order_by(Speciality.name)).all():
            specs.setdefault(cid, []).append(sname)
    return {"items": [{**_card(c, names), "specialities": specs.get(c.id, [])} for c in rows],
            "total": total, "page": page, "page_size": page_size}

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
    # Only admin-VERIFIED specialities and capabilities are shown as confirmed on the public profile.
    ver = VerificationStatus.VERIFIED
    specs = [r.speciality.name for r in db.scalars(select(CompSpec).where(CompSpec.company_id == c.id, CompSpec.verification_status == ver))
             if r.speciality.is_active]
    caps = [{"category": r.category.name, "dosage_form_group": r.category.group.name,
             "formulation_types": sorted(t.name for t in r.formulation_types)}
            for r in db.scalars(select(Cap).where(Cap.company_id == c.id, Cap.verification_status == ver))
            if r.category.is_active]
    return {**_card(c, names), "specialities": sorted(specs), "capabilities": sorted(caps, key=lambda x: (x["dosage_form_group"], x["category"])),
            "address": c.address, "brochure_url": c.brochure_url,
            "products": [{"name": p.name, "slug": p.slug, "composition": p.composition,
                          "dosage_form": p.dosage_form, "pack_size": p.pack_size, "image_url": p.image_url} for p in products]}
