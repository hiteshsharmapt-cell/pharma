from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import get_db
from app.models import Company, Product, Role, User
from app.schemas.auth import LoginIn, SupplierRegister, TokenOut, UserOut
from app.services.slugs import unique_slug

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: SupplierRegister, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == data.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    # Role is always SUPPLIER here; admins are created only via create_admin.py.
    user = User(name=data.name, email=data.email.lower(), mobile=data.mobile,
                password_hash=hash_password(data.password), role=Role.SUPPLIER)
    db.add(user); db.flush()
    company = Company(user_id=user.id, name=data.company_name, slug=unique_slug(db, Company, data.company_name),
                      business_type=data.business_type, city_id=data.city_id, state_id=data.state_id,
                      email=user.email, phone=user.mobile)  # status defaults to PENDING
    db.add(company); db.flush()
    seen = set()
    for p in data.products:
        key = p.name.strip().lower()
        if key in seen:
            continue  # (company_id, name) is unique; skip duplicate rows
        seen.add(key)
        db.add(Product(company_id=company.id, name=p.name.strip(), composition=p.composition,
                       dosage_form=p.dosage_form, pack_size=p.pack_size,
                       slug=unique_slug(db, Product, f"{p.name}-{company.slug}")))  # status defaults to PENDING
        db.flush()  # autoflush is off, so flush to keep slugs unique within this request
    db.commit()
    return TokenOut(access_token=create_access_token(user.id, user.role.value), user=UserOut.model_validate(user))

@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(access_token=create_access_token(user.id, user.role.value), user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
# Logout is client-side (discard the token); add a denylist later if server-side revocation is needed.
