import enum
from datetime import datetime
from sqlalchemy import (Column, DateTime, Enum, ForeignKey, Index, String,
                        Table, Text, UniqueConstraint, func)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Role(str, enum.Enum): BUYER="BUYER"; SUPPLIER="SUPPLIER"; ADMIN="ADMIN"
class UserStatus(str, enum.Enum): ACTIVE="ACTIVE"; DISABLED="DISABLED"
class CompanyStatus(str, enum.Enum): PENDING="PENDING"; APPROVED="APPROVED"; REJECTED="REJECTED"; SUSPENDED="SUSPENDED"
class ProductStatus(str, enum.Enum): PENDING="PENDING"; APPROVED="APPROVED"; REJECTED="REJECTED"
class ActiveStatus(str, enum.Enum): ACTIVE="ACTIVE"; INACTIVE="INACTIVE"
class LocationType(str, enum.Enum): STATE="STATE"; CITY="CITY"
class RequirementStatus(str, enum.Enum): NEW="NEW"; VERIFIED="VERIFIED"; ASSIGNED="ASSIGNED"; CLOSED="CLOSED"
class LeadStatus(str, enum.Enum):
    NEW="NEW"; CONTACTED="CONTACTED"; INTERESTED="INTERESTED"; CONVERTED="CONVERTED"; CLOSED="CLOSED"

class TS:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class User(TS, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    mobile: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.BUYER, index=True)
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.ACTIVE)
    company: Mapped["Company | None"] = relationship(back_populates="user", uselist=False)

class Location(Base):
    __tablename__ = "locations"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    type: Mapped[LocationType] = mapped_column(Enum(LocationType))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(Enum(ActiveStatus), default=ActiveStatus.ACTIVE)

class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    status: Mapped[ActiveStatus] = mapped_column(Enum(ActiveStatus), default=ActiveStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

company_categories = Table("company_categories", Base.metadata,
    Column("company_id", ForeignKey("companies.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True))
product_categories = Table("product_categories", Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True))

class Company(TS, Base):
    __tablename__ = "companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    brochure_url: Mapped[str | None] = mapped_column(String(500))
    business_type: Mapped[str] = mapped_column(String(80))
    address: Mapped[str | None] = mapped_column(Text)
    city_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), index=True)
    state_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"), index=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[CompanyStatus] = mapped_column(Enum(CompanyStatus), default=CompanyStatus.PENDING, index=True)
    # Admin-controlled homepage placement: NULL = not featured, 1 = first. Ranks 1-5 are the highlighted "Top 5".
    featured_rank: Mapped[int | None] = mapped_column(index=True, nullable=True)
    user: Mapped[User] = relationship(back_populates="company")
    products: Mapped[list["Product"]] = relationship(back_populates="company", cascade="all, delete-orphan")
    categories: Mapped[list[Category]] = relationship(secondary=company_categories)

class Product(TS, Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("company_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(240), unique=True, index=True)
    composition: Mapped[str | None] = mapped_column(Text)
    dosage_form: Mapped[str | None] = mapped_column(String(80))
    pack_size: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[ProductStatus] = mapped_column(Enum(ProductStatus), default=ProductStatus.PENDING, index=True)
    company: Mapped[Company] = relationship(back_populates="products")
    categories: Mapped[list[Category]] = relationship(secondary=product_categories)

class Requirement(TS, Base):
    __tablename__ = "requirements"
    id: Mapped[int] = mapped_column(primary_key=True)
    buyer_name: Mapped[str] = mapped_column(String(120))
    buyer_mobile: Mapped[str] = mapped_column(String(20))
    buyer_email: Mapped[str] = mapped_column(String(255))
    city_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"))
    state_id: Mapped[int | None] = mapped_column(ForeignKey("locations.id"))
    requirement_type: Mapped[str] = mapped_column(String(60))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    drug_license_status: Mapped[str | None] = mapped_column(String(40))
    gst_status: Mapped[str | None] = mapped_column(String(40))
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[RequirementStatus] = mapped_column(Enum(RequirementStatus), default=RequirementStatus.NEW, index=True)
    leads: Mapped[list["Lead"]] = relationship(back_populates="requirement")

class Lead(TS, Base):
    """One row per (requirement, supplier): many suppliers per requirement is possible later."""
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("requirement_id", "supplier_id"), Index("ix_leads_supplier_status", "supplier_id", "status"))
    id: Mapped[int] = mapped_column(primary_key=True)
    requirement_id: Mapped[int] = mapped_column(ForeignKey("requirements.id", ondelete="CASCADE"))
    supplier_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())
    contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    requirement: Mapped[Requirement] = relationship(back_populates="leads")

# Catalogue tables (specialities, dosage forms, product categories, capabilities). Imported last so that
# Base.metadata.create_all() and any migration tooling see every table.
from app.models.catalog import (CompanyProductCapability, CompanySpeciality, DosageFormGroup,  # noqa: E402,F401
                                FormulationType, ProductCategory, Speciality, VerificationStatus,
                                capability_formulation_types, product_category_specialities)
