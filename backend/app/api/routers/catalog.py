from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import (DosageFormGroup, FormulationType, ProductCategory, Speciality,
                        product_category_specialities)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _simple(r):
    return {"id": r.id, "name": r.name, "slug": r.slug, "description": r.description}


@router.get("/specialities")
def specialities(db: Session = Depends(get_db)):
    return [_simple(r) for r in db.scalars(select(Speciality).where(Speciality.is_active).order_by(Speciality.name))]


@router.get("/dosage-forms")
def dosage_forms(db: Session = Depends(get_db)):
    rows = db.scalars(select(DosageFormGroup).where(DosageFormGroup.is_active)
                      .order_by(DosageFormGroup.sort_order, DosageFormGroup.name))
    return [_simple(r) for r in rows]


@router.get("/formulation-types")
def formulation_types(db: Session = Depends(get_db)):
    return [_simple(r) for r in db.scalars(select(FormulationType).where(FormulationType.is_active).order_by(FormulationType.name))]


@router.get("/product-categories")
def product_categories(dosage_form_group_id: int | None = None, speciality_id: int | None = None,
                       db: Session = Depends(get_db)):
    """Active categories, optionally limited to one dosage form group and/or to the categories suggested for a speciality."""
    q = (select(ProductCategory, DosageFormGroup.name).join(DosageFormGroup, DosageFormGroup.id == ProductCategory.dosage_form_group_id)
         .where(ProductCategory.is_active, DosageFormGroup.is_active))
    if dosage_form_group_id:
        q = q.where(ProductCategory.dosage_form_group_id == dosage_form_group_id)
    if speciality_id:
        q = q.where(ProductCategory.id.in_(select(product_category_specialities.c.product_category_id)
                                           .where(product_category_specialities.c.speciality_id == speciality_id)))
    return [{**_simple(c), "dosage_form_group_id": c.dosage_form_group_id, "dosage_form_group": g, "parent_id": c.parent_id}
            for c, g in db.execute(q.order_by(ProductCategory.name)).all()]
