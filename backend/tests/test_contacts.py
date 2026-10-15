import hashlib, hmac, json
import pytest
from conftest import admin_headers, make_company, token

OK = {"name": "Ravi Kumar", "phone": "98765 43210", "requirement": "Need PCD franchise for cardiac range"}

@pytest.fixture(autouse=True)
def _reset_limiter():
    from app.api.routers import contacts
    contacts._hits.clear()

def test_popup_saves_and_normalizes(env, db):
    from app.models import Contact
    assert env.post("/api/contacts", json=OK).status_code == 201
    c = db.query(Contact).one()
    assert c.phone == "9876543210" and c.source == "popup"
    # duplicate within minutes is not stored twice
    env.post("/api/contacts", json=OK)
    assert db.query(Contact).count() == 1

def test_validation_honeypot_ratelimit(env, db):
    from app.models import Contact
    assert env.post("/api/contacts", json={**OK, "phone": "12345"}).status_code == 422
    assert env.post("/api/contacts", json={**OK, "name": "x"}).status_code == 422
    assert env.post("/api/contacts", json={**OK, "company_website": "spam.com"}).status_code == 201
    assert db.query(Contact).count() == 0  # honeypot: pretended success, nothing stored
    for i in range(5):
        assert env.post("/api/contacts", json={**OK, "requirement": f"need {i} products"}).status_code == 201
    assert env.post("/api/contacts", json={**OK, "requirement": "one more please"}).status_code == 429

def test_admin_only_list_search_export_delete(env, db):
    env.post("/api/contacts", json=OK)
    env.post("/api/contacts", json={**OK, "name": "=cmd|' /C calc'!A0", "phone": "9123456780", "requirement": "other thing"})
    h = admin_headers(db)
    assert env.get("/api/admin/contacts").status_code == 401
    u, _ = make_company(db, "Zeta")
    assert env.get("/api/admin/contacts", headers=token(u)).status_code == 403
    r = env.get("/api/admin/contacts", headers=h).json()
    assert r["total"] == 2 and r["items"][0]["phone"]
    assert env.get("/api/admin/contacts?q=9876", headers=h).json()["total"] == 1
    csv_text = env.get("/api/admin/contacts/export.csv", headers=h).text
    assert "9876543210" in csv_text and "'=cmd" in csv_text  # formula injection neutralised
    cid = r["items"][0]["id"]
    assert env.delete(f"/api/admin/contacts/{cid}", headers=h).status_code == 200
    assert env.get("/api/admin/contacts", headers=h).json()["total"] == 1

def test_public_apis_never_expose_numbers(env, db):
    env.post("/api/contacts", json=OK)
    for path in ("/api/companies", "/api/products", "/api/companies/featured"):
        assert "9876543210" not in env.get(path).text

def _sign(body: bytes, secret="s3cret"): return hmac.new(secret.encode(), body, hashlib.sha1).hexdigest()

def test_tawk_webhook(env, db, monkeypatch):
    from app.core.config import settings
    from app.models import Contact
    body = json.dumps({"event": "chat:start", "visitor": {"name": "Anil", "email": "a@x.com"},
                       "message": {"text": "hi call me on +91 98111 22233"}}).encode()
    assert env.post("/api/webhooks/tawk", content=body).status_code == 503  # secret not set
    monkeypatch.setattr(settings, "TAWK_WEBHOOK_SECRET", "s3cret")
    assert env.post("/api/webhooks/tawk", content=body, headers={"x-tawk-signature": "bad"}).status_code == 401
    assert env.post("/api/webhooks/tawk", content=body, headers={"x-tawk-signature": _sign(body)}).status_code == 200
    c = db.query(Contact).one()
    assert (c.name, c.email, c.phone, c.source) == ("Anil", "a@x.com", "9811122233", "chat")
    other = json.dumps({"event": "chat:end"}).encode()
    assert env.post("/api/webhooks/tawk", content=other, headers={"x-tawk-signature": _sign(other)}).json()["ignored"] == "chat:end"
