from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.security import decode_token
from app.db.base import get_db
from app.models import Role, User, UserStatus

_bearer = HTTPBearer(auto_error=False)

def get_current_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
                     db: Session = Depends(get_db)) -> User:
    payload = decode_token(cred.credentials) if cred else None
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user = db.get(User, int(payload["sub"]))  # role is read from DB, never trusted from the token
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid account")
    return user

def require_roles(*roles: Role):
    def dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user
    return dep

require_admin = require_roles(Role.ADMIN)
require_supplier = require_roles(Role.SUPPLIER)
