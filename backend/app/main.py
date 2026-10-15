from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from app.core.config import settings
from app.api.routers import (admin, admin_catalog, admin_requirements, auth, catalog, categories, companies, contacts, images, locations, products,
                             requirements, supplier, supplier_catalog)

app = FastAPI(title="Pharma Marketplace API")
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS.split(","),
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(admin.router)
app.include_router(admin_requirements.router)
app.include_router(companies.router)
app.include_router(categories.router)
app.include_router(requirements.router)
app.include_router(supplier.router)
app.include_router(products.router)
app.include_router(catalog.router)
app.include_router(admin_catalog.router)
app.include_router(supplier_catalog.router)
app.include_router(images.router)
app.include_router(contacts.router)

@app.get("/api/health")
def health(): return {"ok": True}
