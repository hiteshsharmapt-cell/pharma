from sqlalchemy import select
from app.db.base import SessionLocal
from app.models import ActiveStatus, Category
from app.services.slugs import slugify

NAMES = ["PCD Pharma Franchise", "Pharmaceutical Manufacturing", "Third Party Manufacturing", "Derma",
         "Ayurvedic", "Veterinary", "Nutraceuticals", "Pediatric", "Gynae", "Cardiac / Diabetic"]

with SessionLocal() as db:
    for n in NAMES:
        if not db.scalar(select(Category.id).where(Category.slug == slugify(n))):
            db.add(Category(name=n, slug=slugify(n), status=ActiveStatus.ACTIVE))
    db.commit()
    print("Categories:", db.query(Category).count())
