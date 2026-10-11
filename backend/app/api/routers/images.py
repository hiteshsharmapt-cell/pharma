"""Logo and product-image upload/remove, for admins (any company) and suppliers (their own).
The browser sends the raw image bytes as the request body (Content-Type: image/*), so no extra packages are required."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.api.deps import require_admin, require_supplier
from app.db.base import get_db
from app.models import Company, Product, User
from app.services.images import upload_image

router = APIRouter(tags=["images"])

async def _read(request: Request) -> bytes:
    # Reject oversized bodies early using the declared length, then re-check the real size in validate().
    if int(request.headers.get("content-length") or 0) > 3 * 1024 * 1024:
        raise HTTPException(413, "Image is too large. Maximum size is 2 MB.")
    return await request.body()

def _set_logo(db: Session, c: Company, url: str | None):
    c.logo_url = url; db.commit()
    return {"logo_url": c.logo_url}

def _set_image(db: Session, p: Product, url: str | None):
    p.image_url = url; db.commit()
    return {"image_url": p.image_url}

def _own_product(db: Session, user: User, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not user.company or not p or p.company_id != user.company.id:
        raise HTTPException(404, "Product not found")
    return p

# ---- admin ----
def _company(db: Session, company_id: int) -> Company:
    c = db.get(Company, company_id)
    if not c: raise HTTPException(404, "Company not found")
    return c

def _product(db: Session, product_id: int) -> Product:
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "Product not found")
    return p

@router.put("/api/admin/companies/{company_id}/logo", dependencies=[Depends(require_admin)])
async def admin_set_logo(company_id: int, request: Request, db: Session = Depends(get_db)):
    c = _company(db, company_id); return _set_logo(db, c, upload_image(await _read(request), "pharmaconnect/logos"))

@router.delete("/api/admin/companies/{company_id}/logo", dependencies=[Depends(require_admin)])
def admin_delete_logo(company_id: int, db: Session = Depends(get_db)):
    return _set_logo(db, _company(db, company_id), None)

@router.put("/api/admin/products/{product_id}/image", dependencies=[Depends(require_admin)])
async def admin_set_image(product_id: int, request: Request, db: Session = Depends(get_db)):
    p = _product(db, product_id); return _set_image(db, p, upload_image(await _read(request), "pharmaconnect/products"))

@router.delete("/api/admin/products/{product_id}/image", dependencies=[Depends(require_admin)])
def admin_delete_image(product_id: int, db: Session = Depends(get_db)):
    return _set_image(db, _product(db, product_id), None)

# ---- supplier (own company only) ----
def _my_company(user: User) -> Company:
    if not user.company: raise HTTPException(404, "No company profile found")
    return user.company

@router.put("/api/supplier/logo")
async def supplier_set_logo(request: Request, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    c = _my_company(user); return _set_logo(db, c, upload_image(await _read(request), "pharmaconnect/logos"))

@router.delete("/api/supplier/logo")
def supplier_delete_logo(user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    return _set_logo(db, _my_company(user), None)

@router.put("/api/supplier/products/{product_id}/image")
async def supplier_set_image(product_id: int, request: Request, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    p = _own_product(db, user, product_id); return _set_image(db, p, upload_image(await _read(request), "pharmaconnect/products"))

@router.delete("/api/supplier/products/{product_id}/image")
def supplier_delete_image(product_id: int, user: User = Depends(require_supplier), db: Session = Depends(get_db)):
    return _set_image(db, _own_product(db, user, product_id), None)
