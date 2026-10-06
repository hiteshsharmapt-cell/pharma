from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.db.base import get_db
from app.models import Category, Company, CompanyStatus, Lead, Location, Requirement, RequirementStatus

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

class AssignIn(BaseModel):
    supplier_id: int

@router.get("/suppliers")
def approved_suppliers(db: Session = Depends(get_db)):
    rows = db.scalars(select(Company).where(Company.status == CompanyStatus.APPROVED).order_by(Company.name)).all()
    return [{"id": c.id, "name": c.name} for c in rows]

@router.get("/requirements")
def list_requirements(db: Session = Depends(get_db)):
    locs = {l.id: l.name for l in db.scalars(select(Location)).all()}
    cats = {c.id: c.name for c in db.scalars(select(Category)).all()}
    comps = {c.id: c.name for c in db.scalars(select(Company)).all()}
    reqs = db.scalars(select(Requirement).order_by(Requirement.created_at.desc())).all()
    return [{"id": r.id, "buyer_name": r.buyer_name, "buyer_mobile": r.buyer_mobile, "buyer_email": r.buyer_email,
             "city": locs.get(r.city_id), "state": locs.get(r.state_id), "requirement_type": r.requirement_type,
             "category": cats.get(r.category_id), "drug_license_status": r.drug_license_status,
             "gst_status": r.gst_status, "message": r.message, "status": r.status.value, "created_at": r.created_at,
             "assigned": [{"lead_id": l.id, "company": comps.get(l.supplier_id), "status": l.status.value} for l in r.leads]}
            for r in reqs]

@router.post("/requirements/{req_id}/assign", status_code=201)
def assign_lead(req_id: int, data: AssignIn, db: Session = Depends(get_db)):
    req = db.get(Requirement, req_id)
    if not req:
        raise HTTPException(404, "Requirement not found")
    company = db.get(Company, data.supplier_id)
    if not company or company.status != CompanyStatus.APPROVED:
        raise HTTPException(400, "Choose an approved supplier")
    lead = Lead(requirement_id=req.id, supplier_id=company.id)  # status NEW, assigned_at set by DB
    db.add(lead)
    req.status = RequirementStatus.ASSIGNED
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Already assigned to this supplier")
    return {"lead_id": lead.id}
