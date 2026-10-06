from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import ActiveStatus, Category

router = APIRouter(prefix="/api/categories", tags=["categories"])

@router.get("")
def list_categories(db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.status == ActiveStatus.ACTIVE).order_by(Category.name)).all()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "parent_id": c.parent_id} for c in rows]
