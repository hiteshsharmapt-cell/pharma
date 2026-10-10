"""Turns the OLD data into relational catalogue mappings, as UNVERIFIED suggestions for an admin to review.

    python map_existing_categories.py            # dry run: only prints what it would do
    python map_existing_categories.py --apply    # writes the suggestions

Nothing is ever marked Verified here. Existing rows are never changed or removed. Anything that cannot be mapped
with confidence is listed in the report for manual review instead of being guessed.

Sources: (1) a company's old categories (Derma, Pediatric ...)  ->  specialities
         (2) the free-text dosage_form of its products          ->  product categories
"""
import sys
from collections import Counter
from sqlalchemy import select
from app.db.base import SessionLocal
from app.models import (Company, CompanyProductCapability as Cap, CompanySpeciality as CompSpec, ProductCategory,
                        Product, Speciality, VerificationStatus)

CATEGORY_TO_SPECIALITY = {
    "Derma": ["Dermatology"], "Pediatric": ["Paediatrics"], "Gynae": ["Gynaecology"],
    "Cardiac / Diabetic": ["Cardiology", "Diabetology"], "Ayurvedic": ["Ayurvedic / Herbal"], "Veterinary": ["Veterinary"],
    "Nutraceuticals": ["Nutraceuticals / Nutritional Supplements"],
}
# Business-model labels, not therapeutic areas: never mapped.
NOT_A_SPECIALITY = {"PCD Pharma Franchise", "Pharmaceutical Manufacturing", "Third Party Manufacturing"}
DOSAGE_TO_CATEGORY = {"Tablet": "Tablets", "Capsule": "Capsules", "Syrup": "Syrups", "Gel": "Gels", "Powder": "Oral Powders"}
# Too vague to map ("Injection" could be liquid, dry powder, lyophilised...; "Drops" could be oral, eye, ear, nasal).
AMBIGUOUS_DOSAGE = {"Injection", "Ointment / Cream", "Drops", "Other"}


def main(apply: bool):
    review, plan = Counter(), Counter()
    with SessionLocal() as db:
        specs = {s.name: s for s in db.scalars(select(Speciality))}
        cats = {c.name: c for c in db.scalars(select(ProductCategory))}
        if not specs or not cats:
            raise SystemExit("Run seed_catalog.py first.")
        for comp in db.scalars(select(Company)):
            have_s = {r.speciality_id for r in db.scalars(select(CompSpec).where(CompSpec.company_id == comp.id))}
            for old in comp.categories:
                if old.name in NOT_A_SPECIALITY:
                    review[f"old category '{old.name}' is a business model, not a speciality (not mapped)"] += 1
                    continue
                targets = CATEGORY_TO_SPECIALITY.get(old.name)
                if not targets:
                    review[f"old category '{old.name}' has no known speciality (not mapped)"] += 1
                    continue
                for t in targets:
                    if specs[t].id in have_s:
                        plan["speciality already mapped (skipped)"] += 1; continue
                    plan["speciality suggestions"] += 1; have_s.add(specs[t].id)
                    if apply:
                        db.add(CompSpec(company_id=comp.id, speciality_id=specs[t].id, verification_status=VerificationStatus.UNVERIFIED,
                                        notes=f"Suggested from the old category '{old.name}'. Needs review."))
            have_c = {r.product_category_id for r in db.scalars(select(Cap).where(Cap.company_id == comp.id))}
            for form in {p.dosage_form for p in db.scalars(select(Product).where(Product.company_id == comp.id)) if p.dosage_form}:
                if form in AMBIGUOUS_DOSAGE or form not in DOSAGE_TO_CATEGORY:
                    review[f"product dosage form '{form}' is ambiguous or unknown (not mapped)"] += 1
                    continue
                cat = cats[DOSAGE_TO_CATEGORY[form]]
                if cat.id in have_c:
                    plan["capability already mapped (skipped)"] += 1; continue
                plan["capability suggestions"] += 1; have_c.add(cat.id)
                if apply:
                    db.add(Cap(company_id=comp.id, product_category_id=cat.id, verification_status=VerificationStatus.UNVERIFIED,
                               notes=f"Suggested because the company lists a '{form}' product. Needs review."))
        if apply:
            db.commit()
    print("APPLIED" if apply else "DRY RUN (nothing written; add --apply to write)")
    for k, v in plan.items(): print(f"  {v:5d}  {k}")
    if review:
        print("Needs manual review:")
        for k, v in review.items(): print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main("--apply" in sys.argv)
