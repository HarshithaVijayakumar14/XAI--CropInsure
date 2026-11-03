from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.database.models import User
from backend.app.core.security import verify_password
from backend.app.core.auth import create_access_token, get_current_user

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class LanguageUpdateRequest(BaseModel):
    language_code: str

class UserProfileResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    phone_number: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    preferred_language: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse

@router.post("/login", response_model=LoginResponse)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == creds.username).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "phone_number": user.phone_number,
            "state": user.state,
            "district": user.district,
            "village": user.village,
            "preferred_language": user.preferred_language or "en-IN"
        }
    }

@router.get("/me", response_model=UserProfileResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "phone_number": current_user.phone_number,
        "state": current_user.state,
        "district": current_user.district,
        "village": current_user.village,
        "preferred_language": current_user.preferred_language or "en-IN"
    }

@router.post("/demo-switch", response_model=LoginResponse)
def demo_switch_user(username: str, db: Session = Depends(get_db)):
    """Fast-switch user between demo personas (Ramesh Patel, Sunita Devi, Officer Verma)."""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"Demo user '{username}' not found")
    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "phone_number": user.phone_number,
            "state": user.state,
            "district": user.district,
            "village": user.village,
            "preferred_language": user.preferred_language or "en-IN"
        }
    }

@router.get("/demo-users", response_model=List[UserProfileResponse])
def list_demo_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "phone_number": u.phone_number,
            "state": u.state,
            "district": u.district,
            "village": u.village,
            "preferred_language": u.preferred_language or "en-IN"
        }
        for u in users
    ]

@router.post("/set-language")
def set_preferred_language(
    body: LanguageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.preferred_language = body.language_code
    db.commit()
    return {"status": "success", "language_code": body.language_code}

