from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.base import get_db
from app.models import ActiveStatus, Location

router = APIRouter(prefix="/api/locations", tags=["locations"])

@router.get("")
def list_locations(db: Session = Depends(get_db)):
    rows = db.scalars(select(Location).where(Location.status == ActiveStatus.ACTIVE).order_by(Location.name)).all()
    return [{"id": r.id, "name": r.name, "slug": r.slug, "type": r.type.value, "parent_id": r.parent_id} for r in rows]
