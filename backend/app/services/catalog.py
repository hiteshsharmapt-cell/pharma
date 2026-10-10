from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import ProductCategory, VerificationStatus

V = VerificationStatus


def visible_statuses(include_unverified: bool) -> list[VerificationStatus]:
    """Verified only by default. With include_unverified, claims still awaiting verification count too
    (rejected claims never do)."""
    return [V.VERIFIED, V.PENDING, V.UNVERIFIED] if include_unverified else [V.VERIFIED]


def expand_categories(db: Session, ids: list[int]) -> set[int]:
    """The given active categories plus all their active descendants (Capsules -> Hard/Soft Gelatin Capsules)."""
    found = set(db.scalars(select(ProductCategory.id).where(ProductCategory.id.in_(ids), ProductCategory.is_active)).all())
    frontier = set(found)
    while frontier:
        kids = set(db.scalars(select(ProductCategory.id).where(ProductCategory.parent_id.in_(frontier),
                                                               ProductCategory.is_active)).all()) - found
        found |= kids
        frontier = kids
    return found
