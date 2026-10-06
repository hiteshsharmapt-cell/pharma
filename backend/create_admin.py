"""Usage: python create_admin.py "Name" admin@example.com 9876543210 'password'"""
import sys
from app.db.base import SessionLocal
from app.core.security import hash_password
from app.models import Role, User
name, email, mobile, pw = sys.argv[1:5]
with SessionLocal() as db:
    db.add(User(name=name, email=email.lower(), mobile=mobile, password_hash=hash_password(pw), role=Role.ADMIN))
    db.commit(); print("Admin created:", email)
