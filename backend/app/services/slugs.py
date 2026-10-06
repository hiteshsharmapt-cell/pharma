import re
from sqlalchemy import select
from sqlalchemy.orm import Session

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "item"

def unique_slug(db: Session, model, text: str) -> str:
    base = slug = slugify(text); n = 2
    while db.scalar(select(model.id).where(model.slug == slug)):
        slug, n = f"{base}-{n}", n + 1
    return slug
