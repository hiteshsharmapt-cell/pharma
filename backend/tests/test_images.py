import pytest
from conftest import admin_headers, make_company, token

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64

@pytest.fixture()
def fake_upload(monkeypatch):
    import app.api.routers.images as m
    from app.services.images import validate
    def fake(data, folder):
        validate(data)  # real validation, fake network
        return f"https://res.cloudinary.com/x/image/upload/{folder}/a.png"
    monkeypatch.setattr(m, "upload_image", fake)

def _prod(db, c):
    from app.models import Product, ProductStatus
    p = Product(company_id=c.id, name="Para 500", slug=f"para-{c.id}", status=ProductStatus.APPROVED)
    db.add(p); db.commit(); return p

def test_logo_and_product_image_flow(env, db, fake_upload):
    h = admin_headers(db)
    u, c = make_company(db, "Zeta Pharma"); p = _prod(db, c)
    r = env.put(f"/api/admin/companies/{c.id}/logo", content=PNG, headers={**h, "Content-Type": "image/png"})
    assert r.status_code == 200 and r.json()["logo_url"].endswith("a.png")
    assert env.get("/api/companies/zeta-pharma").json()["logo_url"]
    r = env.put(f"/api/supplier/products/{p.id}/image", content=PNG, headers={**token(u), "Content-Type": "image/png"})
    assert r.status_code == 200
    assert env.get("/api/products").json()["items"][0]["image_url"]
    assert env.get(f"/api/products/{p.slug}").json()["image_url"]
    assert env.delete(f"/api/supplier/products/{p.id}/image", headers=token(u)).json()["image_url"] is None
    assert env.put("/api/supplier/logo", content=PNG, headers={**token(u), "Content-Type": "image/png"}).status_code == 200

def test_rejects_bad_files_and_other_suppliers(env, db, fake_upload):
    u, c = make_company(db, "Zeta Pharma"); u2, c2 = make_company(db, "Other Co"); p = _prod(db, c)
    h = {**token(u), "Content-Type": "image/png"}
    assert env.put("/api/supplier/logo", content=b"<svg onload=alert(1)>", headers=h).status_code == 415
    assert env.put("/api/supplier/logo", content=PNG + b"0" * (2 * 1024 * 1024), headers=h).status_code == 413
    assert env.put("/api/supplier/logo", content=b"", headers=h).status_code == 400
    # not your product -> 404; supplier cannot use admin endpoint
    assert env.put(f"/api/supplier/products/{p.id}/image", content=PNG, headers={**token(u2), "Content-Type": "image/png"}).status_code == 404
    assert env.put(f"/api/admin/companies/{c.id}/logo", content=PNG, headers=h).status_code == 403

def test_unconfigured_returns_503(env, db):
    u, c = make_company(db, "Zeta Pharma")
    r = env.put("/api/supplier/logo", content=PNG, headers={**token(u), "Content-Type": "image/png"})
    assert r.status_code == 503
