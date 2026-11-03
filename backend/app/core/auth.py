import time
import json
import base64
import hmac
import hashlib
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import User
from backend.app.config import settings

def create_access_token(user: User, expires_in_sec: int = 86400 * 7) -> str:
    """
    Creates a secure signed bearer token.
    Payload contains: user_id, username, role, exp
    """
    payload = {
        "sub": user.id,
        "username": user.username,
        "role": user.role,
        "full_name": user.full_name,
        "exp": int(time.time()) + expires_in_sec
    }
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')
    
    signature = hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        payload_b64.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"

def verify_access_token(token: str) -> Optional[dict]:
    """Verifies HMAC signature and expiration."""
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode('utf-8'),
            payload_b64.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return None
            
        # Add padding back if necessary
        rem = len(payload_b64) % 4
        padded = payload_b64 + ('=' * (4 - rem) if rem else '')
        payload_bytes = base64.urlsafe_b64decode(padded)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        if payload.get("exp", 0) < time.time():
            return None # Expired
            
        return payload
    except Exception:
        return None

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Extracts and verifies user from Authorization: Bearer <token>."""
    if not authorization or not authorization.startswith("Bearer "):
        # Fallback to default demo farmer (Ramesh Patel) if no header provided in development
        ramesh = db.query(User).filter(User.username == "farmer_ramesh").first()
        if ramesh:
            return ramesh
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def get_current_farmer(current_user: User = Depends(get_current_user)) -> User:
    """Enforces that the authenticated user is a farmer."""
    if current_user.role != "farmer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorised farmers only."
        )
    return current_user

def get_current_officer(current_user: User = Depends(get_current_user)) -> User:
    """Enforces that the authenticated user is an insurance officer."""
    if current_user.role != "officer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorised insurance officers only."
        )
    return current_user

