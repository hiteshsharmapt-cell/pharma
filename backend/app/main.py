from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routers import admin, admin_requirements, auth, categories, companies, locations, products, requirements, supplier

app = FastAPI(title="Pharma Marketplace API")
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

@app.get("/api/health")
def health(): return {"ok": True}
