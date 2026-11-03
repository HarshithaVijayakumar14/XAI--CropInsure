import json
import uuid
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from backend.app.database.models import Claim, ClaimAssessment, TrainedModel, HumanReview, AuditEvent
from backend.app.schemas.claim import ClaimCreate, ClaimUpdate
from backend.app.ml.feature_engineering import validate_claim_data_quality, compute_agricultural_features
from backend.app.ml.shap_explainer import ShapExplanationService
from backend.app.services.explanation_service import FarmerFriendlyExplanationService
from backend.app.services.audit_service import log_audit_event

def generate_claim_reference(db: Session) -> str:
    current_year = datetime.now().year
    count = db.query(Claim).count() + 1
    return f"CLM-{current_year}-{count:04d}"

def create_claim(db: Session, claim_in: ClaimCreate, actor: str = "Assessor") -> Claim:
    ref = claim_in.claim_reference or generate_claim_reference(db)
    
    # Check duplicate
    existing = db.query(Claim).filter(Claim.claim_reference == ref).first()
    if existing:
        ref = f"CLM-{datetime.now().year}-{uuid.uuid4().hex[:4].upper()}"

    data_dict = claim_in.model_dump()
    data_dict.pop("claim_reference", None)

    # Perform quality checks
    flags = validate_claim_data_quality(data_dict)

    claim = Claim(
        claim_reference=ref,
        data_quality_flags=json.dumps(flags),
        status="Ready for assessment",
        **data_dict
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)

    log_audit_event(
        db,
        event_type="CLAIM_CREATED",
        actor=actor,
        details=f"Claim {claim.claim_reference} registered for farmer {claim.farmer_name} (Crop: {claim.crop_type}).",
        claim_id=claim.id,
        new_status=claim.status
    )
    return claim

def get_claims(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None,
    crop_type: Optional[str] = None,
    state: Optional[str] = None
) -> Tuple[List[Claim], int]:
    query = db.query(Claim)
    
    if search:
        search_filter = or_(
            Claim.claim_reference.ilike(f"%{search}%"),
            Claim.farmer_name.ilike(f"%{search}%"),
            Claim.policy_reference.ilike(f"%{search}%"),
            Claim.district.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    if status:
        query = query.filter(Claim.status == status)

    if crop_type:
        query = query.filter(Claim.crop_type == crop_type)

    if state:
        query = query.filter(Claim.state == state)

    total = query.count()
    claims = query.order_by(desc(Claim.created_at)).offset(skip).limit(limit).all()
    return claims, total

def get_claim_by_id(db: Session, claim_id: int) -> Optional[Claim]:
    return db.query(Claim).filter(Claim.id == claim_id).first()

def get_claim_by_reference(db: Session, ref: str) -> Optional[Claim]:
    return db.query(Claim).filter(Claim.claim_reference == ref).first()

def update_claim(db: Session, claim: Claim, update_data: ClaimUpdate, actor: str = "Assessor") -> Claim:
    prev_status = claim.status
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for key, value in update_dict.items():
        setattr(claim, key, value)
    
    # Revalidate
    claim_dict = {c.name: getattr(claim, c.name) for c in claim.__table__.columns}
    flags = validate_claim_data_quality(claim_dict)
    claim.data_quality_flags = json.dumps(flags)
    
    db.commit()
    db.refresh(claim)

    log_audit_event(
        db,
        event_type="CLAIM_UPDATED",
        actor=actor,
        details=f"Claim {claim.claim_reference} updated.",
        claim_id=claim.id,
        previous_status=prev_status,
        new_status=claim.status
    )
    return claim

def assess_claim(db: Session, claim: Claim, model_id: Optional[int] = None, actor: str = "Assessor") -> ClaimAssessment:
    """
    Executes model-based assessment, SHAP local explanation, and generates farmer-friendly summary.
    """
    # Find active model or requested model
    if model_id:
        model_obj = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    else:
        model_obj = db.query(TrainedModel).filter(TrainedModel.is_active == True).first()

    if not model_obj:
        # Fall back to latest model if none is explicitly marked active
        model_obj = db.query(TrainedModel).order_by(desc(TrainedModel.created_at)).first()

    if not model_obj:
        raise ValueError("No trained machine learning model is available in the system. Please train or activate a model first.")

    # Convert claim to DataFrame
    claim_dict = {
        "claim_reference": claim.claim_reference,
        "farmer_name": claim.farmer_name,
        "crop_type": claim.crop_type,
        "season": claim.season,
        "state": claim.state,
        "district": claim.district,
        "cultivated_area": claim.cultivated_area,
        "observed_rainfall": claim.observed_rainfall,
        "reference_rainfall": claim.reference_rainfall,
        "soil_moisture": claim.soil_moisture,
        "observed_temperature": claim.observed_temperature,
        "reference_temperature": claim.reference_temperature,
        "current_ndvi": claim.current_ndvi,
        "reference_ndvi": claim.reference_ndvi,
    }
    raw_df = pd.DataFrame([claim_dict])

    # Compute features
    feat_df, warnings = compute_agricultural_features(raw_df)

    # Initialize SHAP explainer
    explainer_service = ShapExplanationService(model_obj.file_path)

    # Prediction
    pipeline = explainer_service.pipeline
    prediction_label = None
    prediction_prob = None
    payout_estimate = None

    if model_obj.task_type == "classification":
        pred_raw = pipeline.predict(feat_df)[0]
        if hasattr(pipeline, "predict_proba"):
            probs = pipeline.predict_proba(feat_df)[0]
            prediction_prob = round(float(probs[1] if len(probs) > 1 else probs[0]), 4)
            prediction_label = "Approved" if (pred_raw == 1 or prediction_prob >= 0.5) else "Rejected"
        else:
            prediction_label = "Approved" if pred_raw == 1 else "Rejected"
            prediction_prob = 1.0 if pred_raw == 1 else 0.0
    else:
        pred_val = float(pipeline.predict(feat_df)[0])
        payout_estimate = round(max(0.0, pred_val), 2)

    # SHAP local explanation
    shap_result = explainer_service.explain_instance(feat_df)
    base_val = shap_result["base_value"]
    contributions = shap_result["shap_contributions"]

    # Quality warnings
    data_flags = json.loads(claim.data_quality_flags or "[]")
    all_warnings = data_flags + warnings

    # Generate farmer-friendly explanation
    explanation = FarmerFriendlyExplanationService.generate_explanation(
        claim_data=claim_dict,
        task_type=model_obj.task_type,
        prediction_label=prediction_label,
        prediction_probability=prediction_prob,
        payout_estimate=payout_estimate,
        base_value=base_val,
        shap_contributions=contributions,
        data_quality_warnings=all_warnings
    )

    assessment = ClaimAssessment(
        claim_id=claim.id,
        model_id=model_obj.id,
        prediction_label=prediction_label,
        prediction_probability=prediction_prob,
        payout_estimate=payout_estimate,
        base_value=base_val,
        shap_values_json=json.dumps(contributions),
        farmer_friendly_summary=explanation["summary_text"],
        missing_evidence_notes="; ".join(all_warnings) if all_warnings else "None. All core inputs provided.",
        data_quality_status="Warnings Flagged" if all_warnings else "Clean"
    )
    db.add(assessment)

    # Update claim status
    prev_status = claim.status
    claim.status = "Model assessed"
    db.commit()
    db.refresh(assessment)

    log_audit_event(
        db,
        event_type="ASSESSMENT_RUN",
        actor=actor,
        details=(
            f"Model {model_obj.model_name} assessed claim {claim.claim_reference}. "
            f"Prediction: {prediction_label or payout_estimate}. Confidence: {prediction_prob}."
        ),
        claim_id=claim.id,
        previous_status=prev_status,
        new_status=claim.status
    )

    return assessment
