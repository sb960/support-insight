import os
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

# Operational configuration constants
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-dev-key-change-in-production")
JWT_ALGORITHM = "HS256"

security_scheme = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """
    FastAPI Dependency that intercepts requests, extracts the Bearer token,
    verifies its signature, and returns the authenticated user payload.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Pull claims out safely
        user_id: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role") # e.g., "agent", "admin"
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing identity subject."
            )
            
        return {"user_id": user_id, "role": role}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired."
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials signature."
        )

def require_admin_role(current_user: dict = Depends(get_current_user)):
    """
    Secondary policy layer to prevent basic agents from deleting/modifying core SOP sets.
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to alter corporate SOP states."
        )
    return current_user