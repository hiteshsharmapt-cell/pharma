import subprocess, sys
from pathlib import Path
from sqlalchemy import select
from conftest import admin_headers, by_slug, make_company, token
from app.models import (CompanyProductCapability as Cap, CompanySpeciality as CS, DosageFormGroup, FormulationType,
                        ProductCategory, Speciality, VerificationStatus as V)


def claim_spec(db, company, slug, status=V.VERIFIED):
    db.add(CS(company_id=company.id, speciality_id=by_slug(db, Speciality, slug).id, verification_status=status, notes="test")); db.commit()


def claim_cap(db, company, slug, status=V.VERIFIED, forms=()):
    cap = Cap(company_id=company.id, product_category_id=by_slug(db, ProductCategory, slug).id, verification_status=status, notes="test")
    cap.formulation_types = [by_slug(db, FormulationType, f) for f in forms]
    db.add(cap); db.commit()


def ids(res):
    return sorted(i["name"] for i in res.json()["items"])


# ---- seed / migration ----
def test_master_data_seeded_and_idempotent(env, db):
    import seed_catalog
    seed_catalog.main()  # second run must not duplicate anything
    assert len(env.get("/api/catalog/specialities").json()) == 25
    assert len(env.get("/api/catalog/dosage-forms").json()) == 10
    assert len(env.get("/api/catalog/formulation-types").json()) == 7
    cats = env.get("/api/catalog/product-categories").json()
    assert len({c["slug"] for c in cats}) == len(cats) == 52
    hard = by_slug(db, ProductCategory, "hard-gelatin-capsules")
    assert hard.parent_id == by_slug(db, ProductCategory, "capsules").id
    liquid = env.get(f"/api/catalog/product-categories?dosage_form_group_id={by_slug(db, DosageFormGroup, 'liquid').id}").json()
    assert "Eye Drops" in {c["name"] for c in liquid} and "Tablets" not in {c["name"] for c in liquid}
    # suggested link only: no company got anything
    assert db.scalars(select(CS)).first() is None and db.scalars(select(Cap)).first() is None


def test_migration_script_is_idempotent(env):
    from app.core.config import settings
    for _ in range(2):
        r = subprocess.run([sys.executable, "migrate_catalog.py"], cwd=Path(__file__).resolve().parents[1],
                           capture_output=True, text=True, env={**__import__("os").environ})
        assert r.returncode == 0, r.stderr


# ---- search ----
def test_only_verified_by_default_and_rejected_never(env, db):
    _, a = make_company(db, "Alpha"); _, b = make_company(db, "Beta"); _, c = make_company(db, "Gamma"); _, d = make_company(db, "Delta")
    claim_spec(db, a, "ophthalmic", V.VERIFIED); claim_spec(db, b, "ophthalmic", V.PENDING)
    claim_spec(db, c, "ophthalmic", V.UNVERIFIED); claim_spec(db, d, "ophthalmic", V.REJECTED)
    sid = by_slug(db, Speciality, "ophthalmic").id
    assert ids(env.get(f"/api/companies?speciality_id={sid}")) == ["Alpha"]
    assert ids(env.get(f"/api/companies?speciality_id={sid}&include_unverified=true")) == ["Alpha", "Beta", "Gamma"]


def test_category_search_includes_child_categories(env, db):
    _, a = make_company(db, "Alpha"); _, b = make_company(db, "Beta")
    claim_cap(db, a, "hard-gelatin-capsules"); claim_cap(db, b, "tablets")
    cid = by_slug(db, ProductCategory, "capsules").id
    assert ids(env.get(f"/api/companies?product_category_id={cid}")) == ["Alpha"]


def test_dosage_form_and_category_independent_of_speciality(env, db):
    _, a = make_company(db, "Alpha"); _, b = make_company(db, "Beta")
    claim_cap(db, a, "eye-drops"); claim_cap(db, b, "tablets")
    liquid = by_slug(db, DosageFormGroup, "liquid").id
    assert ids(env.get(f"/api/companies?dosage_form_group_id={liquid}")) == ["Alpha"]   # no speciality needed
    assert ids(env.get(f"/api/companies?product_category_id={by_slug(db, ProductCategory, 'tablets').id}")) == ["Beta"]


def test_combined_filters_and_same_capability_row(env, db):
    _, a = make_company(db, "Alpha"); _, b = make_company(db, "Beta"); _, c = make_company(db, "Gamma")
    for co in (a, b, c): claim_spec(db, co, "ophthalmic")
    claim_cap(db, a, "eye-drops", forms=["solution"]); claim_cap(db, b, "eye-drops", forms=["suspension"])
    claim_cap(db, c, "tablets", forms=["solution"])
    base = (f"/api/companies?speciality_id={by_slug(db, Speciality, 'ophthalmic').id}"
            f"&dosage_form_group_id={by_slug(db, DosageFormGroup, 'liquid').id}"
            f"&product_category_id={by_slug(db, ProductCategory, 'eye-drops').id}")
    assert ids(env.get(base)) == ["Alpha", "Beta"]
    assert ids(env.get(base + f"&formulation_type_id={by_slug(db, FormulationType, 'solution').id}")) == ["Alpha"]
    # Gamma has Solution, but on Tablets (a different capability row), so it must not match Eye Drops + Solution
    assert "Gamma" not in ids(env.get(base + f"&formulation_type_id={by_slug(db, FormulationType, 'solution').id}"))


def test_no_duplicate_companies(env, db):
    _, a = make_company(db, "Alpha")
    for s in ("eye-drops", "ear-drops", "nasal-drops"): claim_cap(db, a, s)
    claim_spec(db, a, "ent"); claim_spec(db, a, "ophthalmic")
    liquid = by_slug(db, DosageFormGroup, "liquid").id
    r = env.get(f"/api/companies?dosage_form_group_id={liquid}&speciality_id={by_slug(db, Speciality, 'ent').id}"
                f"&speciality_id={by_slug(db, Speciality, 'ophthalmic').id}").json()
    assert r["total"] == 1 and len(r["items"]) == 1


def test_unapproved_companies_and_inactive_masters_hidden(env, db):
    _, a = make_company(db, "Alpha", status="PENDING"); _, b = make_company(db, "Beta")
    claim_spec(db, a, "ent"); claim_spec(db, b, "ent")
    sid = by_slug(db, Speciality, "ent").id
    assert ids(env.get(f"/api/companies?speciality_id={sid}")) == ["Beta"]
    db.get(Speciality, sid).is_active = False; db.commit()
    assert "ENT" not in {s["name"] for s in env.get("/api/catalog/specialities").json()}


def test_pagination_and_existing_filters_still_work(env, db):
    for i in range(5): make_company(db, f"Co{i}")
    r = env.get("/api/companies?page_size=2&page=3").json()
    assert r["total"] == 5 and len(r["items"]) == 1
    assert env.get("/api/companies?q=Co3").json()["total"] == 1


def test_public_profile_shows_only_verified(env, db):
    _, a = make_company(db, "Alpha")
    claim_spec(db, a, "ent", V.VERIFIED); claim_spec(db, a, "dermatology", V.PENDING)
    claim_cap(db, a, "ear-drops", V.VERIFIED, ["solution"]); claim_cap(db, a, "creams", V.UNVERIFIED)
    p = env.get("/api/companies/alpha").json()
    assert p["specialities"] == ["ENT"]
    assert [c["category"] for c in p["capabilities"]] == ["Ear Drops"] and p["capabilities"][0]["formulation_types"] == ["Solution"]


# ---- admin ----
def test_admin_requires_admin_role(env, db):
    u, _ = make_company(db, "Alpha")
    assert env.get("/api/admin/catalog/specialities").status_code == 401
    assert env.get("/api/admin/catalog/specialities", headers=token(u)).status_code == 403


def test_admin_crud_duplicates_and_safe_delete(env, db):
    h = admin_headers(db)
    r = env.post("/api/admin/catalog/specialities", json={"name": "Rheumatology"}, headers=h)
    assert r.status_code == 201 and r.json()["is_active"] is True
    assert env.post("/api/admin/catalog/specialities", json={"name": "rheumatology"}, headers=h).status_code == 409
    sid = r.json()["id"]
    assert env.patch(f"/api/admin/catalog/specialities/{sid}", json={"name": "ENT"}, headers=h).status_code == 409
    assert env.patch(f"/api/admin/catalog/specialities/{sid}", json={"description": "d", "is_active": False}, headers=h).json()["is_active"] is False
    assert env.delete(f"/api/admin/catalog/specialities/{sid}", headers=h).status_code == 200      # unused: deletable
    _, a = make_company(db, "Alpha"); claim_spec(db, a, "ent")
    ent = by_slug(db, Speciality, "ent").id
    assert env.delete(f"/api/admin/catalog/specialities/{ent}", headers=h).status_code == 409        # in use: deactivate instead
    assert env.patch(f"/api/admin/catalog/specialities/{ent}", json={"is_active": False}, headers=h).status_code == 200


def test_admin_category_rules(env, db):
    h = admin_headers(db)
    solid, liquid = by_slug(db, DosageFormGroup, "solid").id, by_slug(db, DosageFormGroup, "liquid").id
    assert env.post("/api/admin/catalog/product-categories", json={"name": "Tablets", "dosage_form_group_id": solid}, headers=h).status_code == 409
    ok = env.post("/api/admin/catalog/product-categories", json={"name": "Tablets", "dosage_form_group_id": liquid}, headers=h)
    assert ok.status_code == 201                                       # same name in another group is allowed
    caps = by_slug(db, ProductCategory, "capsules"); hard = by_slug(db, ProductCategory, "hard-gelatin-capsules")
    assert env.patch(f"/api/admin/catalog/product-categories/{caps.id}", json={"parent_id": hard.id}, headers=h).status_code == 422  # loop
    assert env.patch(f"/api/admin/catalog/product-categories/{caps.id}", json={"parent_id": caps.id}, headers=h).status_code == 422
    assert env.post("/api/admin/catalog/product-categories", json={"name": "X", "dosage_form_group_id": solid, "parent_id": ok.json()["id"]}, headers=h).status_code == 422
    sp = by_slug(db, Speciality, "cardiology").id
    r = env.patch(f"/api/admin/catalog/product-categories/{caps.id}", json={"speciality_ids": [sp]}, headers=h)
    assert r.json()["speciality_ids"] == [sp]
    assert env.get("/api/admin/catalog/product-categories?q=capsule&page_size=2", headers=h).json()["total"] >= 3
    # deactivated category disappears from public lists and from search
    _, a = make_company(db, "Alpha"); claim_cap(db, a, "capsules")
    cid = caps.id
    assert env.get(f"/api/companies?product_category_id={cid}").json()["total"] == 1
    env.patch(f"/api/admin/catalog/product-categories/{cid}", json={"is_active": False}, headers=h)
    assert env.get(f"/api/companies?product_category_id={cid}").json()["total"] == 0
    assert "Capsules" not in {c["name"] for c in env.get("/api/catalog/product-categories").json()}


def test_verification_needs_evidence_and_is_visible_after(env, db):
    h = admin_headers(db); _, a = make_company(db, "Alpha")
    sid = by_slug(db, Speciality, "ent").id
    url = f"/api/admin/companies/{a.id}/specialities/{sid}"
    assert env.put(url, json={"verification_status": "VERIFIED"}, headers=h).status_code == 422
    assert env.put(url, json={"verification_status": "VERIFIED", "evidence_source": "Site visit 2026-10-01"}, headers=h).status_code == 200
    assert env.get(f"/api/companies?speciality_id={sid}").json()["total"] == 1
    env.put(url, json={"verification_status": "REJECTED", "notes": "no proof"}, headers=h)
    assert env.get(f"/api/companies?speciality_id={sid}&include_unverified=true").json()["total"] == 0
    g = env.get(f"/api/admin/companies/{a.id}/capabilities", headers=h).json()
    assert g["specialities"][0]["verification_status"] == "REJECTED" and g["company"]["name"] == "Alpha"
    cap_url = f"/api/admin/companies/{a.id}/capabilities/{by_slug(db, ProductCategory, 'eye-drops').id}"
    ft = by_slug(db, FormulationType, "solution").id
    assert env.put(cap_url, json={"verification_status": "VERIFIED", "notes": "GMP cert", "formulation_type_ids": [ft]}, headers=h).status_code == 200
    assert env.get(f"/api/admin/companies/{a.id}/capabilities", headers=h).json()["capabilities"][0]["formulation_type_ids"] == [ft]
    assert env.delete(cap_url, headers=h).status_code == 200


# ---- supplier self-claims ----
def test_supplier_claims_are_pending_and_cannot_self_verify(env, db):
    u, a = make_company(db, "Alpha"); h = token(u)
    ent, tabs = by_slug(db, Speciality, "ent").id, by_slug(db, ProductCategory, "tablets").id
    assert env.put("/api/supplier/capabilities", json={}).status_code == 401
    r = env.put("/api/supplier/capabilities", json={"speciality_ids": [ent], "capabilities": [{"product_category_id": tabs}]}, headers=h)
    assert r.status_code == 200
    mine = env.get("/api/supplier/capabilities", headers=h).json()
    assert mine["specialities"][0]["verification_status"] == "PENDING" and mine["capabilities"][0]["verification_status"] == "PENDING"
    assert env.get(f"/api/companies?speciality_id={ent}").json()["total"] == 0           # not shown as confirmed
    assert env.put(f"/api/admin/companies/{a.id}/specialities/{ent}", json={"verification_status": "VERIFIED", "notes": "x"}, headers=h).status_code == 403
    assert env.put("/api/supplier/capabilities", json={"speciality_ids": [999999]}, headers=h).status_code == 422


def test_supplier_edit_resets_verification_and_keeps_rejected(env, db):
    u, a = make_company(db, "Alpha"); h = token(u)
    claim_cap(db, a, "eye-drops", V.VERIFIED, ["solution"]); claim_spec(db, a, "ent", V.REJECTED)
    cat, sol, sus, ent = (by_slug(db, ProductCategory, "eye-drops").id, by_slug(db, FormulationType, "solution").id,
                          by_slug(db, FormulationType, "suspension").id, by_slug(db, Speciality, "ent").id)
    env.put("/api/supplier/capabilities", json={"speciality_ids": [ent], "capabilities": [{"product_category_id": cat, "formulation_type_ids": [sol]}]}, headers=h)
    m = env.get("/api/supplier/capabilities", headers=h).json()
    assert m["capabilities"][0]["verification_status"] == "VERIFIED"      # unchanged claim stays verified
    assert m["specialities"][0]["verification_status"] == "REJECTED"      # re-saving cannot undo a rejection
    env.put("/api/supplier/capabilities", json={"speciality_ids": [ent], "capabilities": [{"product_category_id": cat, "formulation_type_ids": [sol, sus]}]}, headers=h)
    assert env.get("/api/supplier/capabilities", headers=h).json()["capabilities"][0]["verification_status"] == "PENDING"


# ---- existing-data mapping ----
def test_existing_data_mapping_is_unverified_only(env, db):
    from app.models import ActiveStatus, Category, Product
    import map_existing_categories as m
    _, a = make_company(db, "Alpha")
    derma = Category(name="Derma", slug="derma", status=ActiveStatus.ACTIVE); pcd = Category(name="PCD Pharma Franchise", slug="pcd", status=ActiveStatus.ACTIVE)
    a.categories = [derma, pcd]
    db.add_all([Product(company_id=a.id, name="P1", slug="p1", dosage_form="Tablet"), Product(company_id=a.id, name="P2", slug="p2", dosage_form="Injection")]); db.commit()
    m.main(apply=False)
    assert db.scalars(select(CS)).first() is None                           # dry run writes nothing
    m.main(apply=True); m.main(apply=True)                                   # twice: no duplicates
    db.expire_all()
    rows = db.scalars(select(CS)).all(); caps = db.scalars(select(Cap)).all()
    assert [r.speciality.slug for r in rows] == ["dermatology"] and [c.category.slug for c in caps] == ["tablets"]
    assert all(x.verification_status == V.UNVERIFIED for x in [*rows, *caps])
