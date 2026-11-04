import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.session import get_db
from backend.app.database.models import Claim, ClaimAssessment, TrainedModel
from backend.app.schemas.assessment import (
    AssessmentRequest,
    AssessmentResponse,
    ShapFeatureContribution,
    PMFBYRuleAssessmentResult
)
from backend.app.services.claim_service import assess_claim, get_claim_by_id
from backend.app.services.pmfby_rules_service import PMFBYRuleAssessmentService

router = APIRouter()

def _build_claim_dict(claim: Claim) -> Dict[str, Any]:
    return {
        "claim_reference": claim.claim_reference,
        "farmer_name": claim.farmer_name,
        "state": claim.state,
        "district": claim.district,
        "crop_type": claim.crop_type,
        "season": claim.season,
        "cultivated_area": claim.cultivated_area,
        "sowing_date": claim.sowing_date,
        "loss_date": claim.loss_date,
        "loss_description": claim.loss_description,
        "growth_stage": claim.growth_stage,
        "observed_rainfall": claim.observed_rainfall,
        "reference_rainfall": claim.reference_rainfall,
        "observed_temperature": claim.observed_temperature,
        "reference_temperature": claim.reference_temperature,
        "current_ndvi": claim.current_ndvi,
        "reference_ndvi": claim.reference_ndvi,
        "created_at": claim.created_at,
        "policy_reference": claim.policy_reference,
        "insurance_scheme": claim.insurance_scheme,
        "sum_insured": claim.sum_insured
    }

@router.get("/claims/{claim_id}/statutory-rules", response_model=PMFBYRuleAssessmentResult)
def get_claim_statutory_rules(claim_id: int, db: Session = Depends(get_db)):
    """
    Evaluates official PMFBY statutory rules, selective notification deadlines (72h),
    peril-category consistency, and document verification checklists.
    Separate from machine learning statistical scoring.
    """
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    claim_dict = _build_claim_dict(claim)
    rule_res = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_dict)
    return PMFBYRuleAssessmentResult(**rule_res)

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

    # Evaluate Pillar 1 Statutory Rules
    claim_dict = _build_claim_dict(claim)
    rule_dict = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_dict)
    statutory_rules = PMFBYRuleAssessmentResult(**rule_dict)

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
        statutory_rules=statutory_rules,
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

    # Evaluate Pillar 1 Statutory Rules
    claim_dict = _build_claim_dict(claim)
    rule_dict = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_dict)
    statutory_rules = PMFBYRuleAssessmentResult(**rule_dict)

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
        statutory_rules=statutory_rules,
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

