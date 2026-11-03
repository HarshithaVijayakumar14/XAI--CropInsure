import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.database.session import get_db
from backend.app.database.models import User, Claim, HumanReview, AuditEvent, ClaimAssessment
from backend.app.core.auth import get_current_officer
from backend.app.services.audit_service import log_audit_event

router = APIRouter()

class OfficerReviewRequest(BaseModel):
    decision: str  # 'Approved', 'Rejected', 'Additional Evidence Required', 'Escalated'
    rationale: str
    verified_crop_loss: Optional[float] = None
    required_evidence: Optional[str] = None
    workflow_stage: Optional[str] = "decision_recorded"

@router.get("/dashboard/summary")
def get_officer_overall_statistics(
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """
    Returns OVERALL CLAIM STATISTICS for the authorized insurance officer dashboard.
    Clearly separates aggregate statistics from individual farmer data.
    """
    total_claims = db.query(Claim).count()
    
    approved_claims = db.query(Claim).filter(
        (Claim.status == "Approved") | (Claim.status == "Human review completed")
    ).count()

    waiting_claims = db.query(Claim).filter(
        Claim.status.in_(["Ready for assessment", "Model assessed", "Awaiting human review", "Submitted"])
    ).count()

    needs_attention = db.query(Claim).filter(
        (Claim.status == "Additional evidence required") | (Claim.status == "Rejected")
    ).count()

    # Crop breakdown
    crop_counts = db.query(Claim.crop_type, func.count(Claim.id)).group_by(Claim.crop_type).all()
    crop_stats = [{"crop": c[0], "count": c[1]} for c in crop_counts]

    # District breakdown
    district_counts = db.query(Claim.district, func.count(Claim.id)).group_by(Claim.district).all()
    district_stats = [{"district": d[0], "count": d[1]} for d in district_counts]

    return {
        "title": "Overall Claim Statistics — Across All Regions",
        "officer_name": current_officer.full_name,
        "kpis": {
            "total_claims": total_claims,
            "waiting_for_review": waiting_claims,
            "claims_approved": approved_claims,
            "claims_needing_attention": needs_attention
        },
        "aggregate_charts": {
            "crop_distribution": crop_stats,
            "district_distribution": district_stats,
            "label": "Overall Claim Statistics (Aggregate)"
        },
        "notice": "Overall Claim Statistics describe aggregated portfolio metrics and must not be confused with individual farmer claims."
    }

@router.get("/claims")
def get_claims_for_review(
    filter_type: Optional[str] = "all",
    limit: int = 50,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """Lists claims available for officer review."""
    query = db.query(Claim)
    
    if filter_type == "waiting":
        query = query.filter(Claim.status.in_(["Ready for assessment", "Model assessed", "Awaiting human review"]))
    elif filter_type == "approved":
        query = query.filter((Claim.status == "Approved") | (Claim.status == "Human review completed"))
    elif filter_type == "attention":
        query = query.filter((Claim.status == "Additional evidence required") | (Claim.status == "Rejected"))

    claims = query.order_by(desc(Claim.created_at)).limit(limit).all()

    return [
        {
            "id": c.id,
            "claim_reference": c.claim_reference,
            "farmer_name": c.farmer_name,
            "crop_type": c.crop_type,
            "district": c.district,
            "state": c.state,
            "cultivated_area": c.cultivated_area,
            "reported_loss_pct": c.reported_loss_pct,
            "verified_crop_loss": c.verified_crop_loss,
            "status": c.status,
            "workflow_stage": c.workflow_stage or "application_submitted",
            "sowing_date": c.sowing_date,
            "missing_documents": json.loads(c.missing_documents or "[]"),
            "created_at": c.created_at.strftime("%Y-%m-%d") if c.created_at else None
        }
        for c in claims
    ]

@router.post("/claims/{claim_id}/review")
def record_officer_review(
    claim_id: int,
    review_req: OfficerReviewRequest,
    current_officer: User = Depends(get_current_officer),
    db: Session = Depends(get_db)
):
    """Records an official human review decision and updates claim workflow stage."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    prev_status = claim.status

    # Record review entry
    review = HumanReview(
        claim_id=claim.id,
        reviewer_name=current_officer.full_name,
        reviewer_role=current_officer.role.title(),
        review_decision=review_req.decision,
        rationale=review_req.rationale,
        required_evidence=review_req.required_evidence
    )
    db.add(review)

    # Update claim status and workflow
    if review_req.decision == "Approved":
        claim.status = "Approved"
        claim.workflow_stage = "decision_recorded"
        claim.payment_status = "Processing"
        claim.next_expected_action = "Claim approved. DBT subsidy payment processing initiated."
    elif review_req.decision == "Rejected":
        claim.status = "Rejected"
        claim.workflow_stage = "decision_recorded"
        claim.next_expected_action = "Claim rejected based on officer field verification."
    elif review_req.decision == "Additional Evidence Required":
        claim.status = "Additional evidence required"
        claim.workflow_stage = "documents_checked"
        claim.next_expected_action = f"Awaiting additional evidence: {review_req.required_evidence or 'Requested documents'}"
        if review_req.required_evidence:
            curr_docs = json.loads(claim.missing_documents or "[]")
            if review_req.required_evidence not in curr_docs:
                curr_docs.append(review_req.required_evidence)
                claim.missing_documents = json.dumps(curr_docs)

    if review_req.verified_crop_loss is not None:
        claim.verified_crop_loss = review_req.verified_crop_loss
    claim.officer_notes = review_req.rationale

    db.commit()

    log_audit_event(
        db=db,
        event_type="OFFICER_REVIEW_RECORDED",
        actor=f"{current_officer.full_name} ({current_officer.role})",
        details=f"Decision: {review_req.decision}. Rationale: {review_req.rationale}",
        claim_id=claim.id,
        previous_status=prev_status,
        new_status=claim.status
    )

    return {
        "status": "success",
        "claim_id": claim.id,
        "new_status": claim.status,
        "workflow_stage": claim.workflow_stage
    }

