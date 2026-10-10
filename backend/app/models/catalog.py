"""Speciality / dosage form / product category catalogue and company capability mappings.

Specialities, dosage form groups, product categories and formulation types are independent master lists
managed by admins (never hard-deleted: they are deactivated). A company's claims against them carry a
verification status, so nothing is shown as confirmed until an admin has verified it.
"""
import enum
from datetime import datetime
from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Index, String, Table, Text,
                        UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    PENDING = "PENDING"        # "Pending Verification"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


_now = dict(server_default=func.now())


class _Master:
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), **_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), **_now)


class Speciality(_Master, Base):
    __tablename__ = "specialities"


class DosageFormGroup(_Master, Base):
    __tablename__ = "dosage_form_groups"
    sort_order: Mapped[int] = mapped_column(default=0)


class FormulationType(_Master, Base):
    __tablename__ = "formulation_types"


product_category_specialities = Table(
    "product_category_specialities", Base.metadata,
    Column("product_category_id", ForeignKey("catalog_product_categories.id", ondelete="CASCADE"), primary_key=True),
    Column("speciality_id", ForeignKey("specialities.id", ondelete="CASCADE"), primary_key=True))

capability_formulation_types = Table(
    "capability_formulation_types", Base.metadata,
    Column("capability_id", ForeignKey("company_product_capabilities.id", ondelete="CASCADE"), primary_key=True),
    Column("formulation_type_id", ForeignKey("formulation_types.id", ondelete="CASCADE"), primary_key=True))


class ProductCategory(_Master, Base):
    __tablename__ = "catalog_product_categories"
    __table_args__ = (UniqueConstraint("dosage_form_group_id", "name", name="uq_category_group_name"),)
    dosage_form_group_id: Mapped[int] = mapped_column(ForeignKey("dosage_form_groups.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("catalog_product_categories.id"), index=True)
    group: Mapped[DosageFormGroup] = relationship()
    specialities: Mapped[list[Speciality]] = relationship(secondary=product_category_specialities)


class CompanySpeciality(Base):
    __tablename__ = "company_specialities"
    __table_args__ = (UniqueConstraint("company_id", "speciality_id", name="uq_company_speciality"),
                      Index("ix_company_spec_lookup", "speciality_id", "verification_status"))
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    speciality_id: Mapped[int] = mapped_column(ForeignKey("specialities.id"))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status"), default=VerificationStatus.UNVERIFIED)
    evidence_source: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), **_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), **_now)
    speciality: Mapped[Speciality] = relationship()


class CompanyProductCapability(Base):
    __tablename__ = "company_product_capabilities"
    __table_args__ = (UniqueConstraint("company_id", "product_category_id", name="uq_company_capability"),
                      Index("ix_capability_lookup", "product_category_id", "verification_status"))
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    product_category_id: Mapped[int] = mapped_column(ForeignKey("catalog_product_categories.id"))
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, name="verification_status"), default=VerificationStatus.UNVERIFIED)
    evidence_source: Mapped[str | None] = mapped_column(String(300))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), **_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), **_now)
    category: Mapped[ProductCategory] = relationship()
    formulation_types: Mapped[list[FormulationType]] = relationship(secondary=capability_formulation_types)
