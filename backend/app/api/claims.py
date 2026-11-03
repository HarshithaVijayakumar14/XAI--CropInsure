from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database.session import get_db
from backend.app.schemas.claim import ClaimCreate, ClaimUpdate, ClaimResponse
from backend.app.services.claim_service import (
    create_claim, get_claims, get_claim_by_id, update_claim
)
from backend.app.services.audit_service import log_audit_event
from backend.app.database.models import Claim

router = APIRouter()

@router.get("/claims")
def list_claims(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    status: Optional[str] = None,
    crop_type: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    claims, total = get_claims(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        crop_type=crop_type,
        state=state
    )
    return {
        "items": claims,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.post("/claims", response_model=ClaimResponse, status_code=201)
def create_new_claim(claim_in: ClaimCreate, db: Session = Depends(get_db)):
    try:
        claim = create_claim(db=db, claim_in=claim_in)
        return claim
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/claims/{claim_id}", response_model=ClaimResponse)
def get_single_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim

@router.put("/claims/{claim_id}", response_model=ClaimResponse)
def update_existing_claim(claim_id: int, update_data: ClaimUpdate, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    updated = update_claim(db=db, claim=claim, update_data=update_data)
    return updated

@router.delete("/claims/{claim_id}", status_code=200)
def delete_claim(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    ref = claim.claim_reference
    log_audit_event(
        db,
        event_type="CLAIM_DELETED",
        actor="Assessor",
        details=f"Claim {ref} was deleted from records.",
        claim_id=claim.id
    )
    db.delete(claim)
    db.commit()
    return {"message": f"Claim {ref} deleted successfully."}

