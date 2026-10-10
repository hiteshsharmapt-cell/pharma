"""A supplier declares which specialities and product categories it works in. Everything it adds is saved as
PENDING (Pending Verification): only an admin can mark a claim Verified."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import require_supplier
from app.db.base import get_db
from app.models import (CompanyProductCapability as Cap, CompanySpeciality as CompSpec, FormulationType, ProductCategory,
                        Speciality, User, VerificationStatus)

router = APIRouter(prefix="/api/supplier/capabilities", tags=["supplier-capabilities"])
V = VerificationStatus


class CapIn(BaseModel):
    product_category_id: int
    formulation_type_ids: list[int] = Field(default_factory=list, max_length=20)


class CapabilitiesIn(BaseModel):
    speciality_ids: list[int] = Field(default_factory=list, max_length=100)
    capabilities: list[CapIn] = Field(default_factory=list, max_length=200)


def _mine(user: User):
    if not user.company:
        raise HTTPException(404, "No company profile found")
    return user.company


@router.get("")
def get_mine(user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _mine(user)
    return {"specialities": [{"speciality_id": r.speciality_id, "verification_status": r.verification_status.value, "notes": r.notes}
                             for r in db.scalars(select(CompSpec).where(CompSpec.company_id == c.id))],
            "capabilities": [{"product_category_id": r.product_category_id, "verification_status": r.verification_status.value,
                              "notes": r.notes, "formulation_type_ids": sorted(t.id for t in r.formulation_types)}
                             for r in db.scalars(select(Cap).where(Cap.company_id == c.id))]}


@router.put("")
def save_mine(data: CapabilitiesIn, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _mine(user)
    want_specs = set(data.speciality_ids)
    active_specs = {s.id: s for s in db.scalars(select(Speciality).where(Speciality.id.in_(want_specs)))} if want_specs else {}
    have = {r.speciality_id: r for r in db.scalars(select(CompSpec).where(CompSpec.company_id == c.id))}
    for sid in want_specs:
        if sid not in have:
            if sid not in active_specs or not active_specs[sid].is_active:
                raise HTTPException(422, f"Unknown or inactive speciality: {sid}")
            db.add(CompSpec(company_id=c.id, speciality_id=sid, verification_status=V.PENDING,
                            notes="Added by supplier, awaiting verification"))
    for sid, row in have.items():
        if sid not in want_specs:
            db.delete(row)

    want = {x.product_category_id: sorted(set(x.formulation_type_ids)) for x in data.capabilities}
    cats = {k.id: k for k in db.scalars(select(ProductCategory).where(ProductCategory.id.in_(want)))} if want else {}
    fts = {f.id: f for f in db.scalars(select(FormulationType))}
    have_caps = {r.product_category_id: r for r in db.scalars(select(Cap).where(Cap.company_id == c.id))}
    for cid, ft_ids in want.items():
        if any(i not in fts for i in ft_ids):
            raise HTTPException(422, "Unknown formulation type")
        row = have_caps.get(cid)
        if not row:
            if cid not in cats or not cats[cid].is_active:
                raise HTTPException(422, f"Unknown or inactive product category: {cid}")
            row = Cap(company_id=c.id, product_category_id=cid, verification_status=V.PENDING,
                      notes="Added by supplier, awaiting verification")
            db.add(row)
            row.formulation_types = [fts[i] for i in ft_ids]
        elif sorted(t.id for t in row.formulation_types) != ft_ids:
            row.formulation_types = [fts[i] for i in ft_ids]
            if row.verification_status == V.VERIFIED:   # the verified claim changed, so it must be checked again
                row.verification_status = V.PENDING
    for cid, row in have_caps.items():
        if cid not in want:
            db.delete(row)
    db.commit()
    return {"ok": True}
