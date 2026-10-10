"""Seeds the master lists: specialities, dosage form groups, product categories, formulation types and the
suggested speciality-to-category links. Safe to re-run (existing rows are kept, nothing is overwritten).

    python seed_catalog.py

Specialities are only a master list. This script never assigns anything to a company.
"""
from sqlalchemy import func, select
from app.db.base import SessionLocal
from app.models import DosageFormGroup, FormulationType, ProductCategory, Speciality
from app.services.slugs import slugify

SPECIALITIES = ["General Medicine", "Antibiotics / Anti-infectives", "Cardiology", "Diabetology", "Gastroenterology",
    "Dermatology", "Ophthalmic", "ENT", "Gynaecology", "Paediatrics", "Orthopaedics", "Neurology", "Psychiatry",
    "Respiratory Medicine", "Urology", "Nephrology", "Oncology", "Endocrinology", "Dental Care", "Pain Management",
    "Hormonal Products", "Nutraceuticals / Nutritional Supplements", "Ayurvedic / Herbal", "Veterinary",
    "Surgical / Medical Devices"]

# dosage form group -> categories. A tuple (name, parent) nests the category under another one in the same group.
GROUPS = {
    "Solid": ["Tablets", "Capsules", ("Hard Gelatin Capsules", "Capsules"), ("Soft Gelatin Capsules", "Capsules"),
              "Chewable Tablets", "Dispersible Tablets", "Enteric-Coated Tablets", "Sustained-Release Tablets"],
    # Eye Drops, Ear Drops, Nasal Drops and Nasal Sprays are not in the original list but are required by its
    # Ophthalmic / ENT examples, so they are added here under Liquid.
    "Liquid": ["Syrups", "Oral Solutions", "Oral Suspensions", "Oral Drops", "Elixirs",
               "Eye Drops", "Ear Drops", "Nasal Drops", "Nasal Sprays"],
    "Semi-solid": ["Creams", "Ointments", "Gels", "Lotions", "Pastes", "Liniments", "Eye Ointments", "Ophthalmic Gels"],
    "Powder & Granules": ["Dry Syrups", "Oral Powders", "Sachets", "Granules", "Effervescent Powders"],
    "Injectable": ["Liquid Injections", "Dry Powder Injections", "Lyophilized Injections", "Injectable Suspensions",
                   "Pre-filled Syringes"],
    "Inhalation": ["Metered-Dose Inhalers", "Dry Powder Inhalers", "Nebulizer Solutions"],
    "Transdermal": ["Transdermal Patches", "Medicated Patches"],
    "Suppository / Pessary": ["Suppositories", "Enemas", "Pessaries", "Vaginal Tablets"],
    "Oromucosal": ["Lozenges", "Buccal Tablets", "Sublingual Tablets", "Oral Films"],
    "Dental / Oral Care": ["Mouthwashes", "Medicated Gargles", "Dental Gels", "Medicated Toothpastes"],
}
FORMULATION_TYPES = ["Solution", "Suspension", "Emulsion", "Film Coated", "Enteric Coated", "Sustained Release", "Lyophilized"]

# Suggested links only (many-to-many). They do not mean any company offers these products.
SUGGESTED = {
    "Ophthalmic": ["Eye Drops", "Eye Ointments", "Ophthalmic Gels"],
    "ENT": ["Ear Drops", "Nasal Drops", "Nasal Sprays"],
    "General Medicine": ["Tablets", "Capsules", "Syrups", "Oral Suspensions"],
    "Dermatology": ["Creams", "Ointments", "Gels", "Lotions"],
}


def get_or_create(db, model, name, **extra):
    slug = slugify(name)
    row = db.scalar(select(model).where(model.slug == slug))
    if row:
        return row, False
    row = model(name=name, slug=slug, is_active=True, **extra)
    db.add(row); db.flush()
    return row, True


def main():
    added = {"specialities": 0, "groups": 0, "categories": 0, "formulation_types": 0, "links": 0}
    with SessionLocal() as db:
        spec = {}
        for n in SPECIALITIES:
            spec[n], new = get_or_create(db, Speciality, n); added["specialities"] += new
        for i, (g, cats) in enumerate(GROUPS.items(), start=1):
            grp, new = get_or_create(db, DosageFormGroup, g, sort_order=i); added["groups"] += new
            for c in cats:  # parents are listed before their children
                name, parent = (c, None) if isinstance(c, str) else c
                slug = slugify(name)
                if db.scalar(select(ProductCategory.id).where(ProductCategory.slug == slug)):
                    continue
                pid = db.scalar(select(ProductCategory.id).where(ProductCategory.slug == slugify(parent))) if parent else None
                db.add(ProductCategory(name=name, slug=slug, dosage_form_group_id=grp.id, parent_id=pid, is_active=True))
                db.flush(); added["categories"] += 1
        for n in FORMULATION_TYPES:
            _, new = get_or_create(db, FormulationType, n); added["formulation_types"] += new
        for sname, cnames in SUGGESTED.items():
            for cn in cnames:
                cat = db.scalar(select(ProductCategory).where(ProductCategory.slug == slugify(cn)))
                if cat and spec[sname] not in cat.specialities:
                    cat.specialities.append(spec[sname]); added["links"] += 1
        db.commit()
        print("Added this run:", added)
        print("Totals:", {m.__tablename__: db.scalar(select(func.count()).select_from(m)) for m in
                          (Speciality, DosageFormGroup, ProductCategory, FormulationType)})


if __name__ == "__main__":
    main()
