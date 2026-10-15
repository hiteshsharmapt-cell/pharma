"""Collecting contact details.
  POST /api/contacts              public pop-up form (validated, rate-limited, honeypot)
  POST /api/webhooks/tawk         Tawk.to chat/ticket events (signature-verified)
  GET/DELETE /api/admin/contacts  admin only: list, search, CSV export, delete
Phone numbers are never returned by any public endpoint."""
import csv, hashlib, hmac, io, json, re, time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from app.api.deps import require_admin
from app.core.config import settings
from app.db.base import get_db
from app.models import Contact

router = APIRouter(tags=["contacts"])

# ---------- helpers ----------
# Indian mobile typed in a chat message: 9811122233, +91 98111 22233, 98111-22233 ...
_PHONE_IN_TEXT = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})(?!\d)")

def normalize_phone(v: str) -> str:
    d = re.sub(r"[\s\-()]", "", v or "")
    d = d.removeprefix("+91").removeprefix("0091")
    if len(d) == 12 and d.startswith("91"):
        d = d[2:]
    if not (d.isdigit() and len(d) == 10 and d[0] in "6789"):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return d

# In-memory limiter: 5 submissions per IP per hour. (Per server process: good enough to stop casual spam.)
_hits: dict[str, deque] = defaultdict(deque)
def _rate_limited(ip: str, limit: int = 5, window: int = 3600) -> bool:
    now = time.time(); q = _hits[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False

def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")) or "?"

# ---------- public pop-up ----------
class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str
    requirement: str = Field(min_length=2, max_length=2000)
    page: str | None = Field(default=None, max_length=300)
    company_website: str | None = None  # honeypot: real visitors never see or fill this

    @field_validator("phone")
    @classmethod
    def _phone(cls, v): return normalize_phone(v)

@router.post("/api/contacts", status_code=201)
def submit_contact(data: ContactIn, request: Request, db: Session = Depends(get_db)):
    if data.company_website:  # a bot filled the hidden field: pretend success, store nothing
        return {"ok": True}
    if _rate_limited(_client_ip(request)):
        raise HTTPException(429, "Too many submissions. Please try again later.")
    since = datetime.now(timezone.utc) - timedelta(minutes=10)
    dup = db.scalar(select(Contact.id).where(Contact.phone == data.phone, Contact.requirement == data.requirement.strip(),
                                             Contact.created_at >= since))
    if not dup:  # double-click / refresh protection
        db.add(Contact(name=data.name.strip(), phone=data.phone, requirement=data.requirement.strip(),
                       source="popup", page=data.page)); db.commit()
    return {"ok": True}

# ---------- Tawk.to webhook ----------
@router.post("/api/webhooks/tawk")
async def tawk_webhook(request: Request, db: Session = Depends(get_db)):
    """Set this URL in Tawk.to > Administration > Webhooks (events: chat start, ticket create) with the same secret
    as TAWK_WEBHOOK_SECRET. Tawk sends name/email (not phone); if the visitor types a number in their message we save it."""
    secret = settings.TAWK_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(503, "Chat webhook is not configured")
    raw = await request.body()
    expected = hmac.new(secret.encode(), raw, hashlib.sha1).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("x-tawk-signature", "")):
        raise HTTPException(401, "Bad signature")
    try:
        p = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Invalid JSON")
    event = str(p.get("event", ""))
    if event not in ("chat:start", "ticket:create"):
        return {"ok": True, "ignored": event}
    who = p.get("visitor") or p.get("requester") or {}
    msg = p.get("message") or {}
    text = (msg.get("text") if isinstance(msg, dict) else None) or (p.get("ticket") or {}).get("message") or ""
    m = _PHONE_IN_TEXT.search(str(text))
    db.add(Contact(name=(who.get("name") or "Chat visitor")[:120], email=(who.get("email") or None),
                   phone=re.sub(r"\D", "", m.group(1)) if m else None, requirement=str(text)[:2000] or None,
                   source="chat" if event == "chat:start" else "ticket"))
    db.commit()
    return {"ok": True}

# ---------- admin ----------
admin = APIRouter(prefix="/api/admin/contacts", tags=["admin"], dependencies=[Depends(require_admin)])

def _row(c: Contact) -> dict:
    return {"id": c.id, "name": c.name, "phone": c.phone, "email": c.email, "requirement": c.requirement,
            "source": c.source, "page": c.page, "created_at": c.created_at}

def _filters(q: str | None, source: str | None):
    f = []
    if q:
        like = f"%{q}%"
        f.append(or_(Contact.name.ilike(like), Contact.phone.ilike(like), Contact.email.ilike(like), Contact.requirement.ilike(like)))
    if source:
        f.append(Contact.source == source)
    return f

@admin.get("")
def list_contacts(q: str | None = None, source: str | None = None, page: int = Query(1, ge=1),
                  page_size: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    f = _filters(q, source)
    total = db.scalar(select(func.count()).select_from(Contact).where(*f)) or 0
    rows = db.scalars(select(Contact).where(*f).order_by(Contact.created_at.desc(), Contact.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [_row(c) for c in rows], "total": total, "page": page, "page_size": page_size}

def _safe(v) -> str:  # stop spreadsheet formula injection from user-typed text
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s

@admin.get("/export.csv")
def export_contacts(q: str | None = None, source: str | None = None, db: Session = Depends(get_db)):
    rows = db.scalars(select(Contact).where(*_filters(q, source)).order_by(Contact.created_at.desc())).all()
    out = io.StringIO(); w = csv.writer(out)
    w.writerow(["Date", "Name", "Phone", "Email", "Requirement", "Source", "Page"])
    for c in rows:
        w.writerow([c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "", _safe(c.name), _safe(c.phone),
                    _safe(c.email), _safe(c.requirement), c.source, _safe(c.page)])
    return Response("﻿" + out.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="contacts.csv"'})

@admin.delete("/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    c = db.get(Contact, contact_id)
    if not c:
        raise HTTPException(404, "Contact not found")
    db.delete(c); db.commit()
    return {"ok": True}

router.include_router(admin)
