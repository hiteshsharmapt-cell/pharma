from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import require_supplier
from app.db.base import get_db
from app.services.slugs import unique_slug
from app.models import (Category, Company, CompanyStatus, Lead, LeadStatus, Location, Product,
                        ProductStatus, Requirement, User)

router = APIRouter(tags=["supplier"])

def _company(user: User) -> Company:
    if not user.company:
        raise HTTPException(404, "No company profile found")
    return user.company

def _approved_company(user: User) -> Company:
    c = _company(user)
    if c.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved to view leads")
    return c

@router.get("/api/supplier/dashboard")
def dashboard(user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _company(user)
    count = lambda *w: db.scalar(select(func.count()).select_from(w[0]).where(*w[1:])) or 0
    return {"company_name": c.name, "logo_url": c.logo_url, "company_status": c.status.value,
            "total_products": count(Product, Product.company_id == c.id),
            "approved_products": count(Product, Product.company_id == c.id, Product.status == ProductStatus.APPROVED),
            "new_leads": count(Lead, Lead.supplier_id == c.id, Lead.status == LeadStatus.NEW),
            "total_leads": count(Lead, Lead.supplier_id == c.id)}

@router.get("/api/leads")
def my_leads(user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _approved_company(user)  # supplier only ever sees leads assigned to their own company
    locs = {l.id: l.name for l in db.scalars(select(Location)).all()}
    cats = {x.id: x.name for x in db.scalars(select(Category)).all()}
    leads = db.scalars(select(Lead).where(Lead.supplier_id == c.id).order_by(Lead.assigned_at.desc())).all()
    out = []
    for l in leads:
        r: Requirement = l.requirement
        out.append({"id": l.id, "status": l.status.value, "assigned_at": l.assigned_at, "notes": l.notes,
                    "buyer_name": r.buyer_name, "buyer_mobile": r.buyer_mobile, "buyer_email": r.buyer_email,
                    "city": locs.get(r.city_id), "state": locs.get(r.state_id), "requirement_type": r.requirement_type,
                    "category": cats.get(r.category_id), "drug_license_status": r.drug_license_status,
                    "gst_status": r.gst_status, "message": r.message})
    return out

class LeadUpdate(BaseModel):
    status: LeadStatus
    notes: str | None = None

@router.patch("/api/leads/{lead_id}")
def update_lead(lead_id: int, data: LeadUpdate, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _approved_company(user)
    lead = db.get(Lead, lead_id)
    if not lead or lead.supplier_id != c.id:  # same 404 for missing and not-yours: no information leak
        raise HTTPException(404, "Lead not found")
    now = datetime.now(timezone.utc)
    lead.status = data.status
    if data.notes is not None: lead.notes = data.notes
    if data.status == LeadStatus.CONTACTED and not lead.contacted_at: lead.contacted_at = now
    if data.status == LeadStatus.CONVERTED and not lead.converted_at: lead.converted_at = now
    db.commit()
    return {"id": lead.id, "status": lead.status.value}


class ProductBody(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    composition: str | None = Field(default=None, max_length=1000)
    dosage_form: str | None = Field(default=None, max_length=80)
    pack_size: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=3000)

def _product_out(p: Product) -> dict:
    return {"id": p.id, "name": p.name, "slug": p.slug, "composition": p.composition, "dosage_form": p.dosage_form,
            "pack_size": p.pack_size, "description": p.description, "image_url": p.image_url, "status": p.status.value}

def _own_product(db: Session, user: User, product_id: int) -> Product:
    c = _company(user)
    p = db.get(Product, product_id)
    if not p or p.company_id != c.id:  # same 404 for missing and not-yours
        raise HTTPException(404, "Product not found")
    return p

def _name_taken(db: Session, company_id: int, name: str, exclude_id: int | None = None) -> bool:
    q = select(Product.id).where(Product.company_id == company_id, func.lower(Product.name) == name.strip().lower())
    if exclude_id:
        q = q.where(Product.id != exclude_id)
    return db.scalar(q) is not None

@router.get("/api/supplier/products")
def my_products(user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _company(user)
    rows = db.scalars(select(Product).where(Product.company_id == c.id).order_by(Product.created_at.desc())).all()
    return [_product_out(p) for p in rows]

@router.post("/api/supplier/products", status_code=201)
def add_product(data: ProductBody, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _company(user)
    if _name_taken(db, c.id, data.name):
        raise HTTPException(409, "You already have a product with this name")
    p = Product(company_id=c.id, name=data.name.strip(), composition=data.composition, dosage_form=data.dosage_form,
                pack_size=data.pack_size, description=data.description,
                slug=unique_slug(db, Product, f"{data.name}-{c.slug}"))  # status defaults to PENDING
    db.add(p); db.commit()
    return _product_out(p)

@router.put("/api/supplier/products/{product_id}")
def edit_product(product_id: int, data: ProductBody, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    p = _own_product(db, user, product_id)
    if _name_taken(db, p.company_id, data.name, exclude_id=p.id):
        raise HTTPException(409, "You already have a product with this name")
    p.name, p.composition, p.dosage_form = data.name.strip(), data.composition, data.dosage_form
    p.pack_size, p.description = data.pack_size, data.description
    p.status = ProductStatus.PENDING  # any edit goes back to admin review
    db.commit()
    return _product_out(p)

@router.delete("/api/supplier/products/{product_id}", status_code=204)
def delete_product(product_id: int, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    db.delete(_own_product(db, user, product_id))
    db.commit()
