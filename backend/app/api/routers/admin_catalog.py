"""Admin management of the catalogue master lists and of each company's verified capabilities."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.db.base import get_db
from app.models import (Company, CompanyProductCapability as Cap, CompanySpeciality as CompSpec, DosageFormGroup,
                        FormulationType, Location, ProductCategory, Speciality, VerificationStatus,
                        capability_formulation_types as cft, product_category_specialities as pcs)
from app.services.slugs import unique_slug

router = APIRouter(prefix="/api/admin", tags=["admin-catalog"], dependencies=[Depends(require_admin)])
KIND = Literal["specialities", "dosage-forms", "formulation-types", "product-categories"]
MODELS = {"specialities": Speciality, "dosage-forms": DosageFormGroup,
          "formulation-types": FormulationType, "product-categories": ProductCategory}
V = VerificationStatus


class MasterIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    dosage_form_group_id: int | None = None      # product categories only
    parent_id: int | None = None                 # product categories only
    speciality_ids: list[int] | None = None      # product categories only: suggested speciality links


class MasterPatch(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    description: str | None = None
    is_active: bool | None = None
    dosage_form_group_id: int | None = None
    parent_id: int | None = None
    clear_parent: bool = False
    speciality_ids: list[int] | None = None


def _usage(db: Session, kind: str, row) -> int:
    if kind == "specialities":
        return db.scalar(select(func.count()).select_from(CompSpec).where(CompSpec.speciality_id == row.id)) or 0
    if kind == "product-categories":
        return db.scalar(select(func.count()).select_from(Cap).where(Cap.product_category_id == row.id)) or 0
    if kind == "dosage-forms":
        return db.scalar(select(func.count()).select_from(ProductCategory).where(ProductCategory.dosage_form_group_id == row.id)) or 0
    return db.scalar(select(func.count()).select_from(cft).where(cft.c.formulation_type_id == row.id)) or 0


def _out(db: Session, kind: str, row) -> dict:
    d = {"id": row.id, "name": row.name, "slug": row.slug, "description": row.description,
         "is_active": row.is_active, "in_use": _usage(db, kind, row)}
    if kind == "product-categories":
        d.update(dosage_form_group_id=row.dosage_form_group_id, dosage_form_group=row.group.name, parent_id=row.parent_id,
                 speciality_ids=sorted(s.id for s in row.specialities))
    return d


def _check_category(db: Session, group_id: int, parent_id: int | None, self_id: int | None):
    if not db.get(DosageFormGroup, group_id):
        raise HTTPException(404, "Dosage form group not found")
    if parent_id is None:
        return
    if parent_id == self_id:
        raise HTTPException(422, "A category cannot be its own parent")
    parent = db.get(ProductCategory, parent_id)
    if not parent:
        raise HTTPException(404, "Parent category not found")
    if parent.dosage_form_group_id != group_id:
        raise HTTPException(422, "Parent category must be in the same dosage form group")
    node = parent
    while node is not None:  # no cycles
        if node.id == self_id:
            raise HTTPException(422, "That parent would create a loop")
        node = db.get(ProductCategory, node.parent_id) if node.parent_id else None


def _dupe(db: Session, kind: str, name: str, group_id: int | None, self_id: int | None):
    model = MODELS[kind]
    q = select(model.id).where(func.lower(model.name) == name.strip().lower())
    if kind == "product-categories":
        q = q.where(model.dosage_form_group_id == group_id)
    if self_id:
        q = q.where(model.id != self_id)
    if db.scalar(q):
        raise HTTPException(409, f'"{name.strip()}" already exists' + (" in this dosage form group" if group_id else ""))


def _set_specs(db: Session, cat: ProductCategory, ids: list[int]):
    rows = db.scalars(select(Speciality).where(Speciality.id.in_(ids))).all() if ids else []
    if len(rows) != len(set(ids)):
        raise HTTPException(404, "Unknown speciality in speciality_ids")
    cat.specialities = list(rows)


@router.get("/catalog/{kind}")
def list_master(kind: KIND, q: str | None = None, active: bool | None = None, dosage_form_group_id: int | None = None,
                page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), db: Session = Depends(get_db)):
    model = MODELS[kind]
    f = []
    if q: f.append(model.name.ilike(f"%{q}%"))
    if active is not None: f.append(model.is_active == active)
    if dosage_form_group_id and kind == "product-categories": f.append(model.dosage_form_group_id == dosage_form_group_id)
    total = db.scalar(select(func.count()).select_from(model).where(*f)) or 0
    rows = db.scalars(select(model).where(*f).order_by(model.name).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_out(db, kind, r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/catalog/{kind}", status_code=201)
def create_master(kind: KIND, data: MasterIn, db: Session = Depends(get_db)):
    model, name = MODELS[kind], data.name.strip()
    extra = {}
    if kind == "product-categories":
        if not data.dosage_form_group_id:
            raise HTTPException(422, "dosage_form_group_id is required")
        _check_category(db, data.dosage_form_group_id, data.parent_id, None)
        extra = {"dosage_form_group_id": data.dosage_form_group_id, "parent_id": data.parent_id}
    _dupe(db, kind, name, extra.get("dosage_form_group_id"), None)
    row = model(name=name, slug=unique_slug(db, model, name), description=data.description, is_active=True, **extra)
    db.add(row); db.flush()
    if kind == "product-categories" and data.speciality_ids is not None:
        _set_specs(db, row, data.speciality_ids)
    db.commit()
    return _out(db, kind, row)


@router.patch("/catalog/{kind}/{item_id}")
def update_master(kind: KIND, item_id: int, data: MasterPatch, db: Session = Depends(get_db)):
    row = db.get(MODELS[kind], item_id)
    if not row:
        raise HTTPException(404, "Not found")
    if kind == "product-categories":
        gid = data.dosage_form_group_id or row.dosage_form_group_id
        pid = None if data.clear_parent else (data.parent_id if data.parent_id is not None else row.parent_id)
        if data.dosage_form_group_id and data.dosage_form_group_id != row.dosage_form_group_id and pid is None and not data.clear_parent:
            pid = None
        _check_category(db, gid, pid, row.id)
        _dupe(db, kind, data.name or row.name, gid, row.id)
        row.dosage_form_group_id, row.parent_id = gid, pid
        if data.speciality_ids is not None:
            _set_specs(db, row, data.speciality_ids)
    elif data.name:
        _dupe(db, kind, data.name, None, row.id)
    if data.name: row.name = data.name.strip()
    if data.description is not None: row.description = data.description
    if data.is_active is not None: row.is_active = data.is_active   # deactivate instead of deleting
    db.commit()
    return _out(db, kind, row)


@router.delete("/catalog/{kind}/{item_id}")
def delete_master(kind: KIND, item_id: int, db: Session = Depends(get_db)):
    """Only an unused entry (e.g. a typo) can be removed. Anything in use must be deactivated instead."""
    row = db.get(MODELS[kind], item_id)
    if not row:
        raise HTTPException(404, "Not found")
    if _usage(db, kind, row) > 0:
        raise HTTPException(409, "This entry is in use. Deactivate it instead of deleting it.")
    if kind == "product-categories" and db.scalar(select(ProductCategory.id).where(ProductCategory.parent_id == row.id).limit(1)):
        raise HTTPException(409, "This category has sub-categories. Deactivate it instead of deleting it.")
    db.delete(row); db.commit()
    return {"ok": True}


# ---------- company claims and verification ----------
class ClaimIn(BaseModel):
    verification_status: VerificationStatus
    evidence_source: str | None = Field(None, max_length=300)
    notes: str | None = None
    formulation_type_ids: list[int] | None = None   # capabilities only


def _need_evidence(d: ClaimIn):
    if d.verification_status == V.VERIFIED and not ((d.evidence_source or "").strip() or (d.notes or "").strip()):
        raise HTTPException(422, "Record evidence or notes before marking a claim as Verified")


def _company(db: Session, company_id: int) -> Company:
    c = db.get(Company, company_id)
    if not c:
        raise HTTPException(404, "Company not found")
    return c


@router.get("/companies/{company_id}/capabilities")
def company_capabilities(company_id: int, db: Session = Depends(get_db)):
    c = _company(db, company_id)
    names = {l.id: l.name for l in db.scalars(select(Location)).all()}
    specs = db.scalars(select(CompSpec).where(CompSpec.company_id == c.id)).all()
    caps = db.scalars(select(Cap).where(Cap.company_id == c.id)).all()
    return {"company": {"id": c.id, "name": c.name, "status": c.status.value, "city": names.get(c.city_id), "state": names.get(c.state_id)},
            "specialities": sorted([{"speciality_id": r.speciality_id, "name": r.speciality.name, "verification_status": r.verification_status.value,
                                     "evidence_source": r.evidence_source, "notes": r.notes} for r in specs], key=lambda x: x["name"]),
            "capabilities": sorted([{"category_id": r.product_category_id, "name": r.category.name, "dosage_form_group": r.category.group.name,
                                     "verification_status": r.verification_status.value, "evidence_source": r.evidence_source, "notes": r.notes,
                                     "formulation_type_ids": sorted(t.id for t in r.formulation_types)} for r in caps],
                                   key=lambda x: (x["dosage_form_group"], x["name"]))}


@router.put("/companies/{company_id}/specialities/{speciality_id}")
def set_company_speciality(company_id: int, speciality_id: int, data: ClaimIn, db: Session = Depends(get_db)):
    _company(db, company_id); _need_evidence(data)
    spec = db.get(Speciality, speciality_id)
    if not spec:
        raise HTTPException(404, "Speciality not found")
    row = db.scalar(select(CompSpec).where(CompSpec.company_id == company_id, CompSpec.speciality_id == speciality_id))
    if not row:
        if not spec.is_active:
            raise HTTPException(422, "This speciality is inactive")
        row = CompSpec(company_id=company_id, speciality_id=speciality_id); db.add(row)
    row.verification_status, row.evidence_source, row.notes = data.verification_status, data.evidence_source, data.notes
    db.commit()
    return {"ok": True}


@router.delete("/companies/{company_id}/specialities/{speciality_id}")
def remove_company_speciality(company_id: int, speciality_id: int, db: Session = Depends(get_db)):
    row = db.scalar(select(CompSpec).where(CompSpec.company_id == company_id, CompSpec.speciality_id == speciality_id))
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row); db.commit()
    return {"ok": True}


@router.put("/companies/{company_id}/capabilities/{category_id}")
def set_company_capability(company_id: int, category_id: int, data: ClaimIn, db: Session = Depends(get_db)):
    _company(db, company_id); _need_evidence(data)
    cat = db.get(ProductCategory, category_id)
    if not cat:
        raise HTTPException(404, "Product category not found")
    row = db.scalar(select(Cap).where(Cap.company_id == company_id, Cap.product_category_id == category_id))
    if not row:
        if not cat.is_active:
            raise HTTPException(422, "This product category is inactive")
        row = Cap(company_id=company_id, product_category_id=category_id); db.add(row)
    row.verification_status, row.evidence_source, row.notes = data.verification_status, data.evidence_source, data.notes
    if data.formulation_type_ids is not None:
        fts = db.scalars(select(FormulationType).where(FormulationType.id.in_(data.formulation_type_ids))).all() if data.formulation_type_ids else []
        if len(fts) != len(set(data.formulation_type_ids)):
            raise HTTPException(404, "Unknown formulation type")
        row.formulation_types = list(fts)
    db.commit()
    return {"ok": True}


@router.delete("/companies/{company_id}/capabilities/{category_id}")
def remove_company_capability(company_id: int, category_id: int, db: Session = Depends(get_db)):
    row = db.scalar(select(Cap).where(Cap.company_id == company_id, Cap.product_category_id == category_id))
    if not row:
        raise HTTPException(404, "Not found")
    db.delete(row); db.commit()
    return {"ok": True}
