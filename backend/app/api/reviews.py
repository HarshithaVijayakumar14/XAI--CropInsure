from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from backend.app.database.session import get_db
from backend.app.database.models import Claim, HumanReview, AuditEvent
from backend.app.schemas.review import ReviewCreateRequest, ReviewResponse, AuditEventResponse
from backend.app.services.audit_service import log_audit_event
from backend.app.services.claim_service import get_claim_by_id

router = APIRouter()

@router.post("/claims/{claim_id}/review", response_model=ReviewResponse)
def record_human_review(claim_id: int, review_in: ReviewCreateRequest, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    # Check whether decision differs from AI prediction automatically
    from backend.app.database.models import ClaimAssessment
    latest_assess = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim.id).order_by(desc(ClaimAssessment.assessed_at)).first()
    differs = review_in.differs_from_model
    if latest_assess:
        ai_approved = (latest_assess.prediction_label == "Approved") or (latest_assess.prediction_probability and latest_assess.prediction_probability >= 0.5)
        officer_approved = review_in.review_decision == "Approved"
        officer_rejected = review_in.review_decision == "Rejected"
        if (ai_approved and officer_rejected) or (not ai_approved and officer_approved):
            differs = True

    review = HumanReview(
        claim_id=claim.id,
        reviewer_name=review_in.reviewer_name,
        reviewer_role=review_in.reviewer_role,
        review_decision=review_in.review_decision,
        differs_from_model=differs,
        rationale=review_in.rationale,
        required_evidence=review_in.required_evidence
    )
    db.add(review)

    prev_status = claim.status
    if review_in.review_decision == "Approved":
        claim.status = "Approved"
        claim.workflow_stage = "decision_recorded"
        claim.payment_status = "Processing"
        claim.next_expected_action = "Claim approved. DBT subsidy payment processing initiated."
    elif review_in.review_decision == "Rejected":
        claim.status = "Rejected"
        claim.workflow_stage = "decision_recorded"
        claim.next_expected_action = "Claim rejected based on officer field verification."
    elif review_in.review_decision == "Additional Evidence Required":
        claim.status = "Additional evidence required"
        claim.workflow_stage = "documents_checked"
        claim.next_expected_action = f"Awaiting additional evidence: {review_in.required_evidence or 'Requested documents'}"
        if review_in.required_evidence:
            import json
            curr_docs = json.loads(claim.missing_documents or "[]")
            if review_in.required_evidence not in curr_docs:
                curr_docs.append(review_in.required_evidence)
                claim.missing_documents = json.dumps(curr_docs)
    else:
        claim.status = review_in.update_workflow_status or "Human review completed"

    if review_in.verified_crop_loss is not None:
        claim.verified_crop_loss = review_in.verified_crop_loss
    if review_in.verified_crop_yield is not None:
        claim.observed_yield = review_in.verified_crop_yield
    claim.officer_notes = review_in.rationale

    db.commit()
    db.refresh(review)

    diff_str = " (Manual Override — Differs from AI model prediction)" if differs else ""
    log_audit_event(
        db,
        event_type="HUMAN_REVIEW_RECORDED",
        actor=f"{review_in.reviewer_name} ({review_in.reviewer_role})",
        details=f"Decision: {review_in.review_decision}{diff_str}. Rationale: {review_in.rationale}",
        claim_id=claim.id,
        previous_status=prev_status,
        new_status=claim.status
    )

    return review

@router.get("/claims/{claim_id}/reviews", response_model=List[ReviewResponse])
def get_claim_reviews(claim_id: int, db: Session = Depends(get_db)):
    reviews = db.query(HumanReview).filter(HumanReview.claim_id == claim_id).order_by(desc(HumanReview.reviewed_at)).all()
    return reviews

@router.get("/claims/{claim_id}/audit", response_model=List[AuditEventResponse])
def get_claim_audit_history(claim_id: int, db: Session = Depends(get_db)):
    events = db.query(AuditEvent).filter(AuditEvent.claim_id == claim_id).order_by(desc(AuditEvent.timestamp)).all()
    return events

@router.get("/audit", response_model=List[AuditEventResponse])
def get_all_audit_events(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    events = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(limit).all()
    return events

