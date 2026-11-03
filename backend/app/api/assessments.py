import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.session import get_db
from backend.app.database.models import Claim, ClaimAssessment, TrainedModel
from backend.app.schemas.assessment import AssessmentRequest, AssessmentResponse, ShapFeatureContribution
from backend.app.services.claim_service import assess_claim, get_claim_by_id

router = APIRouter()

@router.post("/claims/{claim_id}/assess", response_model=AssessmentResponse)
def run_claim_assessment(claim_id: int, request: AssessmentRequest = AssessmentRequest(), db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    try:
        assessment = assess_claim(db=db, claim=claim, model_id=request.model_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment failed: {str(e)}")

    model = db.query(TrainedModel).filter(TrainedModel.id == assessment.model_id).first()
    contributions_raw = json.loads(assessment.shap_values_json or "[]")
    contributions = [ShapFeatureContribution(**c) for c in contributions_raw]

    flags = json.loads(claim.data_quality_flags or "[]")

    return AssessmentResponse(
        id=assessment.id,
        claim_id=claim.id,
        claim_reference=claim.claim_reference,
        model_id=assessment.model_id,
        model_name=model.model_name if model else "Model",
        model_version=model.model_version if model else "v1.0",
        prediction_label=assessment.prediction_label,
        prediction_probability=assessment.prediction_probability,
        payout_estimate=assessment.payout_estimate,
        base_value=assessment.base_value,
        shap_contributions=contributions,
        farmer_friendly_summary=assessment.farmer_friendly_summary,
        missing_evidence_notes=assessment.missing_evidence_notes,
        data_quality_status=assessment.data_quality_status,
        data_quality_warnings=flags,
        assessed_at=assessment.assessed_at
    )

@router.get("/claims/{claim_id}/assessment", response_model=AssessmentResponse)
def get_claim_assessment(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim_id).order_by(desc(ClaimAssessment.assessed_at)).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="No assessment found for this claim. Please run assessment first.")

    model = db.query(TrainedModel).filter(TrainedModel.id == assessment.model_id).first()
    contributions_raw = json.loads(assessment.shap_values_json or "[]")
    contributions = [ShapFeatureContribution(**c) for c in contributions_raw]
    flags = json.loads(claim.data_quality_flags or "[]")

    return AssessmentResponse(
        id=assessment.id,
        claim_id=claim.id,
        claim_reference=claim.claim_reference,
        model_id=assessment.model_id,
        model_name=model.model_name if model else "Model",
        model_version=model.model_version if model else "v1.0",
        prediction_label=assessment.prediction_label,
        prediction_probability=assessment.prediction_probability,
        payout_estimate=assessment.payout_estimate,
        base_value=assessment.base_value,
        shap_contributions=contributions,
        farmer_friendly_summary=assessment.farmer_friendly_summary,
        missing_evidence_notes=assessment.missing_evidence_notes,
        data_quality_status=assessment.data_quality_status,
        data_quality_warnings=flags,
        assessed_at=assessment.assessed_at
    )

@router.get("/claims/{claim_id}/explanation")
def get_claim_explanation_details(claim_id: int, db: Session = Depends(get_db)):
    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim_id).order_by(desc(ClaimAssessment.assessed_at)).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="No assessment found for this claim.")

    contributions = json.loads(assessment.shap_values_json or "[]")
    return {
        "claim_id": claim_id,
        "base_value": assessment.base_value,
        "prediction_label": assessment.prediction_label,
        "prediction_probability": assessment.prediction_probability,
        "payout_estimate": assessment.payout_estimate,
        "contributions": contributions,
        "farmer_friendly_summary": assessment.farmer_friendly_summary,
        "missing_evidence_notes": assessment.missing_evidence_notes
    }

