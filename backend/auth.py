import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, APIKeyHeader
import jwt

from database import resolve_tenant_from_api_key

JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-dev-key-change-in-production")
JWT_ALGORITHM = "HS256"

security_scheme = HTTPBearer()
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_access_token(
    user_id: str,
    role: str,
    tenant_id: str,
    expires_hours: int = 24,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {
        "sub": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_tenant_from_api_key(
    api_key: Optional[str] = Depends(api_key_header),
) -> str:
    """Resolve the corporate workspace from a secured inbound webhook API key."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header.",
        )

    tenant_id = await resolve_tenant_from_api_key(api_key)
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or inactive API key.",
        )
    return tenant_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    """Verify Bearer JWT and return user identity including tenant workspace."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        tenant_id: Optional[str] = payload.get("tenant_id")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing identity subject.",
            )
        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing tenant workspace.",
            )

        return {"user_id": user_id, "role": role, "tenant_id": tenant_id}

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials signature.",
        )


def require_admin_role(current_user: dict = Depends(get_current_user)):
    """Prevent basic agents from altering corporate SOP sets."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to alter corporate SOP states.",
        )
    return current_user
