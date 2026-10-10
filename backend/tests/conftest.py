import os, sys, tempfile
from pathlib import Path

# Use a throw-away SQLite database; must be set before the app is imported.
_db = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_db}"
os.environ.setdefault("JWT_SECRET", "test-secret")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select


@pytest.fixture()
def env():
    from app.db.base import Base, engine
    import app.models  # noqa: F401
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
    import seed_catalog; seed_catalog.main()
    from app.main import app
    return TestClient(app)


@pytest.fixture()
def db(env):
    from app.db.base import SessionLocal
    with SessionLocal() as s:
        yield s


def make_company(db, name, role="SUPPLIER", status="APPROVED"):
    from app.models import Company, CompanyStatus, Role, User
    u = User(name=name, email=f"{name.lower().replace(' ', '')}@t.com", mobile="1", password_hash="x", role=Role(role))
    db.add(u); db.flush()
    c = Company(user_id=u.id, name=name, slug=name.lower().replace(" ", "-"), business_type="Manufacturer", status=CompanyStatus(status))
    db.add(c); db.commit()
    return u, c


def token(user):
    from app.core.security import create_access_token
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role.value)}"}


def admin_headers(db):
    from app.models import Role, User
    u = User(name="Admin", email="admin@t.com", mobile="1", password_hash="x", role=Role.ADMIN)
    db.add(u); db.commit()
    return token(u)


def by_slug(db, model, slug):
    return db.scalar(select(model).where(model.slug == slug))
