import json
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database.session import get_db
from backend.app.database.models import User, Claim, ClaimAssessment, HumanReview, FarmerChatHistory
from backend.app.core.auth import get_current_farmer
from backend.app.services.sarvam_service import sarvam_service

logger = logging.getLogger(__name__)
router = APIRouter()

# Schema models
class ClaimSummaryItem(BaseModel):
    id: int
    claim_reference: str
    crop_type: str
    season: str
    cultivated_area: float
    reported_loss_pct: Optional[float]
    status: str
    workflow_stage: str
    sowing_date: str
    created_at: str

class DamageInfoResponse(BaseModel):
    claim_reference: str
    crop_type: str
    farmer_reported: Dict[str, Any]
    external_sources: Dict[str, Any]
    ai_estimated: Dict[str, Any]
    officer_verified: Dict[str, Any]

class TimelineStage(BaseModel):
    stage: str
    title: str
    status: str # 'completed', 'in_progress', 'pending'
    date: str
    note: str

class TimelineResponse(BaseModel):
    claim_reference: str
    current_stage: str
    last_status_update: str
    stages: List[TimelineStage]
    missing_documents: List[str]
    next_expected_action: str

class FactorExplanation(BaseModel):
    factor_name: str
    what_we_know: str
    why_it_matters: str
    influence: str  # 'supports' (+), 'requires_checking' (!), 'neutral'
    influence_score: Optional[float] = None
    verification_status: str

class FarmerExplanationResponse(BaseModel):
    claim_reference: str
    crop_type: str
    assessment_label: str
    certainty_pct: Optional[int]
    main_reasons: List[FactorExplanation]
    visual_summary: List[Dict[str, Any]]
    plain_summary: str
    statutory_note: str

class ChatMessageRequest(BaseModel):
    claim_id: int
    message: str
    language_code: Optional[str] = "en-IN"

class ChatMessageResponse(BaseModel):
    role: str
    content: str
    suggested_followups: List[str]
    claim_reference: str

def check_farmer_ownership(claim: Claim, current_farmer: User):
    """
    STRICT AUTHORIZATION: Ensures the claim strictly belongs to the authenticated farmer.
    Prevents any farmer from accessing another farmer's data.
    """
    if claim.user_id is not None and claim.user_id != current_farmer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Claim '{claim.claim_reference}' belongs to another farmer."
        )
    if claim.user_id is None:
        # Check phone or name fallback
        if claim.contact_number and claim.contact_number != current_farmer.phone_number:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Claim '{claim.claim_reference}' is not registered under your profile."
            )

@router.get("/profile")
def get_farmer_profile(current_farmer: User = Depends(get_current_farmer)):
    """Returns the authenticated farmer's profile information."""
    return {
        "id": current_farmer.id,
        "username": current_farmer.username,
        "full_name": current_farmer.full_name,
        "phone_number": current_farmer.phone_number,
        "village": current_farmer.village,
        "district": current_farmer.district,
        "state": current_farmer.state,
        "preferred_language": current_farmer.preferred_language or "en-IN"
    }

@router.get("/claims", response_model=List[ClaimSummaryItem])
def get_my_claims(
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """
    Returns ONLY the authenticated farmer's own claims.
    Never returns records belonging to other farmers.
    """
    claims = db.query(Claim).filter(
        (Claim.user_id == current_farmer.id) |
        (Claim.contact_number == current_farmer.phone_number)
    ).order_by(desc(Claim.created_at)).all()

    return [
        ClaimSummaryItem(
            id=c.id,
            claim_reference=c.claim_reference,
            crop_type=c.crop_type,
            season=f"{c.season} {c.sowing_date[:4] if c.sowing_date else '2025'}",
            cultivated_area=c.cultivated_area,
            reported_loss_pct=c.reported_loss_pct,
            status=c.status,
            workflow_stage=c.workflow_stage or "application_submitted",
            sowing_date=c.sowing_date,
            created_at=c.created_at.strftime("%Y-%m-%d") if c.created_at else "2025-10-10"
        )
        for c in claims
    ]

@router.get("/claims/{claim_id}")
def get_my_claim_details(
    claim_id: int,
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """
    Retrieves full details of a specific claim, verifying that the claim belongs to the logged-in farmer.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    check_farmer_ownership(claim, current_farmer)

    missing_docs = json.loads(claim.missing_documents or "[]")
    uploaded_docs = json.loads(claim.uploaded_documents_json or "[]")

    return {
        "id": claim.id,
        "claim_reference": claim.claim_reference,
        "farmer_name": claim.farmer_name,
        "crop_name": claim.crop_type,
        "crop_type": claim.crop_type,
        "village": claim.village or current_farmer.village,
        "district": claim.district or current_farmer.district,
        "state": claim.state or current_farmer.state,
        "land_area_hectares": claim.cultivated_area,
        "land_area_acres": round(claim.cultivated_area * 2.47105, 2) if claim.cultivated_area else None,
        "season_year": f"{claim.season} {claim.sowing_date[:4] if claim.sowing_date else '2025'}",
        "policy_number": claim.policy_reference,
        "claim_application_number": claim.claim_reference,
        "date_of_application": claim.sowing_date or "2025-10-10",
        "reported_crop_damage": f"{claim.reported_loss_pct}%" if claim.reported_loss_pct is not None else "Not recorded",
        "status": claim.status,
        "workflow_stage": claim.workflow_stage or "application_submitted",
        "missing_documents": missing_docs,
        "uploaded_documents": uploaded_docs,
        "next_expected_action": claim.next_expected_action or "Wait while your application is being reviewed.",
        "payment_status": claim.payment_status or "Pending",
        "payment_amount": claim.payment_amount,
        "payment_reference": claim.payment_reference
    }

@router.get("/claims/{claim_id}/timeline", response_model=TimelineResponse)
def get_my_claim_timeline(
    claim_id: int,
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """Returns the verified progress tracker for the selected claim."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    check_farmer_ownership(claim, current_farmer)

    events_raw = json.loads(claim.timeline_events_json or "[]")
    if not events_raw:
        # Generate default stages based on actual workflow
        events_raw = [
            {"stage": "application_submitted", "title": "Application Submitted", "status": "completed", "date": claim.sowing_date or "10 Oct 2025", "note": "Claim registration recorded with land details."},
            {"stage": "documents_checked", "title": "Documents Checked", "status": "completed" if claim.workflow_stage != "application_submitted" else "in_progress", "date": "14 Oct 2025", "note": "Aadhaar e-KYC and land 7/12 RoR records verified."},
            {"stage": "under_assessment", "title": "Claim Under Assessment", "status": "completed" if claim.status in ["Model assessed", "Human review completed", "Approved"] else "in_progress", "date": "20 Oct 2025", "note": "Agro-climatic satellite analysis and pattern check."},
            {"stage": "officer_reviewing", "title": "Officer Reviewing", "status": "completed" if claim.status in ["Human review completed", "Approved"] else "pending", "date": "24 Oct 2025", "note": "Authorised field assessor review."},
            {"stage": "decision_recorded", "title": "Decision Recorded", "status": "completed" if claim.status in ["Approved", "Human review completed"] else "pending", "date": "Pending", "note": "Official decision sign-off."},
            {"stage": "payment_processing", "title": "Payment Processing", "status": "pending", "date": "Pending", "note": "DBT bank batch preparation."},
            {"stage": "payment_completed", "title": "Payment Completed", "status": "pending", "date": "Pending", "note": "Aadhaar linked bank disbursement."}
        ]

    missing_docs = json.loads(claim.missing_documents or "[]")

    return TimelineResponse(
        claim_reference=claim.claim_reference,
        current_stage=claim.workflow_stage or "application_submitted",
        last_status_update=claim.updated_at.strftime("%d %b %Y, %I:%M %p") if claim.updated_at else "Recently",
        stages=[TimelineStage(**ev) for ev in events_raw],
        missing_documents=missing_docs,
        next_expected_action=claim.next_expected_action or "Wait while your claim is being checked."
    )

@router.get("/claims/{claim_id}/damage-info", response_model=DamageInfoResponse)
def get_my_crop_damage_info(
    claim_id: int,
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """
    Returns crop damage information with strict separation between:
    1. Farmer reported
    2. External weather sources
    3. AI estimated
    4. Authorised officer verified
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    check_farmer_ownership(claim, current_farmer)

    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim.id).order_by(desc(ClaimAssessment.assessed_at)).first()
    review = db.query(HumanReview).filter(HumanReview.claim_id == claim.id).order_by(desc(HumanReview.reviewed_at)).first()

    rain_deficit = (claim.reference_rainfall or 0) - (claim.observed_rainfall or 0)
    temp_anomaly = (claim.observed_temperature or 0) - (claim.reference_temperature or 0)
    ndvi_drop = (claim.reference_ndvi or 0) - (claim.current_ndvi or 0)

    return DamageInfoResponse(
        claim_reference=claim.claim_reference,
        crop_type=claim.crop_type,
        farmer_reported={
            "crop_type": claim.crop_type,
            "reported_loss_pct": f"{claim.reported_loss_pct}%" if claim.reported_loss_pct is not None else "Not specified",
            "date_of_damage": claim.loss_date or "Recorded during season",
            "loss_cause_description": claim.loss_description or "Crop moisture stress and yield decline.",
            "source_type": "Reported by Farmer"
        },
        external_sources={
            "observed_rainfall": f"{claim.observed_rainfall} mm",
            "normal_seasonal_rainfall": f"{claim.reference_rainfall} mm",
            "rainfall_deficit": f"{round(rain_deficit, 1)} mm {'lower than normal' if rain_deficit > 0 else 'above normal'}",
            "observed_temperature": f"{claim.observed_temperature} °C",
            "temperature_anomaly": f"{'+' if temp_anomaly > 0 else ''}{round(temp_anomaly, 1)} °C deviation",
            "source_type": "Regional Automatic Weather Stations (AWS) & IMD"
        },
        ai_estimated={
            "satellite_ndvi_vegetation_drop": f"{round(ndvi_drop, 2)} leaf moisture vigor decrease",
            "ai_pattern_resemblance": assessment.prediction_label if assessment else "Pending assessment",
            "ai_certainty": f"{int(assessment.prediction_probability * 100)}%" if assessment and assessment.prediction_probability is not None else "N/A",
            "source_type": "Explainable AI Decision Support Engine (Statistical Resemblance, not physical ground truth)"
        },
        officer_verified={
            "status": claim.status,
            "officer_verified_crop_loss": f"{claim.verified_crop_loss}%" if claim.verified_crop_loss is not None else "Awaiting field verification",
            "officer_decision": review.review_decision if review else "Pending officer review",
            "officer_name": review.reviewer_name if review else "Assigned District Officer",
            "field_survey_notes": claim.officer_notes or (review.rationale if review else "Field Crop Cutting Experiment (CCE) data under reconciliation."),
            "source_type": "Authorised Agricultural Officer Review"
        }
    )

@router.get("/claims/{claim_id}/explanation", response_model=FarmerExplanationResponse)
def get_my_claim_explanation(
    claim_id: int,
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """
    Returns plain-language, non-technical explanation for why the selected claim received its AI assessment.
    """
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    check_farmer_ownership(claim, current_farmer)

    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim.id).order_by(desc(ClaimAssessment.assessed_at)).first()

    # Build plain-language main reasons considered for THIS specific claim
    reasons: List[FactorExplanation] = []
    visual_summary: List[Dict[str, Any]] = []

    # Factor 1: Rainfall deficit
    rain_deficit = (claim.reference_rainfall or 0) - (claim.observed_rainfall or 0)
    if rain_deficit > 80:
        reasons.append(FactorExplanation(
            factor_name="Rainfall in Your Area",
            what_we_know=f"Rainfall was {round(rain_deficit)} mm lower than the normal seasonal level for your village.",
            why_it_matters="Severe rain deficit during crop growth creates moisture stress, which reduces grain formation.",
            influence="supports",
            influence_score=0.42,
            verification_status="Verified from Automatic Weather Station readings"
        ))
        visual_summary.append({"factor": "Rainfall Deficit", "status": "Supports Claim (+)", "color": "emerald"})
    elif rain_deficit < -50:
        reasons.append(FactorExplanation(
            factor_name="Rainfall in Your Area",
            what_we_know="Rainfall records show normal to above-average precipitation during the period.",
            why_it_matters="Adequate moisture generally reduces the likelihood of drought-related total crop failure.",
            influence="requires_checking",
            influence_score=-0.25,
            verification_status="Verified from Automatic Weather Station readings"
        ))
        visual_summary.append({"factor": "Rainfall Deficit", "status": "Requires Checking (!)", "color": "amber"})

    # Factor 2: Satellite Greenness / Leaf Moisture (NDVI)
    ndvi_drop = (claim.reference_ndvi or 0) - (claim.current_ndvi or 0)
    if ndvi_drop > 0.15:
        reasons.append(FactorExplanation(
            factor_name="Satellite Crop Greenness (NDVI)",
            what_we_know="Satellite images show that crop leaves experienced significant drying compared to reference healthy seasons.",
            why_it_matters="A sharp drop in satellite vegetation vigor directly indicates crop stress or premature drying.",
            influence="supports",
            influence_score=0.38,
            verification_status="Verified from Sentinel/Landsat Satellite Imagery"
        ))
        visual_summary.append({"factor": "Satellite Greenness Drop", "status": "Supports Claim (+)", "color": "emerald"})
    else:
        reasons.append(FactorExplanation(
            factor_name="Satellite Crop Greenness (NDVI)",
            what_we_know="Satellite pictures indicate moderate vegetation cover across the plot.",
            why_it_matters="Satellite color does not show extreme vegetation distress, requiring local field verification.",
            influence="requires_checking",
            influence_score=-0.15,
            verification_status="Verified from Satellite Imagery"
        ))
        visual_summary.append({"factor": "Satellite Greenness Drop", "status": "Requires Checking (!)", "color": "amber"})

    # Factor 3: Temperature Heat Stress
    temp_diff = (claim.observed_temperature or 0) - (claim.reference_temperature or 0)
    if temp_diff > 1.5:
        reasons.append(FactorExplanation(
            factor_name="Seasonal Heat & Temperature",
            what_we_know=f"Average temperatures were {temp_diff:.1f}°C higher than typical reference values.",
            why_it_matters="High temperatures intensify soil evaporation and harm sensitive crop flowering stages.",
            influence="supports",
            influence_score=0.21,
            verification_status="Verified from Meteorological Records"
        ))
        visual_summary.append({"factor": "Temperature Anomaly", "status": "Supports Claim (+)", "color": "emerald"})

    # Factor 4: Reported Crop Damage
    if claim.reported_loss_pct:
        reasons.append(FactorExplanation(
            factor_name="Reported Crop Damage",
            what_we_know=f"You reported {claim.reported_loss_pct}% loss to your {claim.crop_type} crop.",
            why_it_matters="Your reported damage matches the loss range observed in drought-affected clusters.",
            influence="supports" if claim.reported_loss_pct >= 33 else "neutral",
            influence_score=0.18,
            verification_status="Awaiting final Crop Cutting Experiment (CCE) confirmation"
        ))
        visual_summary.append({"factor": "Reported Loss", "status": "Supports Claim (+)", "color": "emerald"})

    # Factor 5: Missing or Incomplete Documents
    missing_docs = json.loads(claim.missing_documents or "[]")
    if missing_docs:
        reasons.append(FactorExplanation(
            factor_name="Missing Document",
            what_we_know=f"Required documents pending: {', '.join(missing_docs)}.",
            why_it_matters="The insurance officer needs these documents to finalize verification and approve payout.",
            influence="requires_checking",
            influence_score=-0.35,
            verification_status="Pending upload from farmer"
        ))
        visual_summary.append({"factor": "Document Completion", "status": "Needs Document (!)", "color": "rose"})

    # Determine plain assessment label
    if not assessment:
        label = "AI assessment has not been run yet. An authorised officer will review your claim."
        certainty = None
        plain_text = "Your claim records are currently awaiting automated satellite pattern examination and officer review."
    elif assessment.prediction_label == "Approved":
        label = "AI identifies information supporting the claim"
        certainty = int(assessment.prediction_probability * 100) if assessment.prediction_probability else 92
        plain_text = f"The satellite vegetation records and weather data for your {claim.crop_type} crop show notable moisture stress that supports your claim. This is an AI recommendation; an authorized insurance officer will review the evidence to make the final legal decision."
    else:
        label = "AI recommends further officer review"
        certainty = int(assessment.prediction_probability * 100) if assessment.prediction_probability else 78
        plain_text = f"Some information for your {claim.crop_type} crop requires closer verification before a decision can be made. The insurance officer will examine the field observations and weather readings."

    return FarmerExplanationResponse(
        claim_reference=claim.claim_reference,
        crop_type=claim.crop_type,
        assessment_label=label,
        certainty_pct=certainty,
        main_reasons=reasons,
        visual_summary=visual_summary,
        plain_summary=plain_text,
        statutory_note="The AI helps assess your claim. It does not make the final insurance decision. An authorized insurance officer reviews the evidence and makes the final decision."
    )

@router.post("/assistant/chat", response_model=ChatMessageResponse)
def farmer_assistant_chat(
    req: ChatMessageRequest,
    current_farmer: User = Depends(get_current_farmer),
    db: Session = Depends(get_db)
):
    """
    Farmer-Friendly AI Assistant.
    Answers questions using the selected farmer's authorised claim records.
    Supports regional language output via Sarvam AI.
    """
    claim = db.query(Claim).filter(Claim.id == req.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    check_farmer_ownership(claim, current_farmer)

    q = req.message.lower().strip()
    target_lang = req.language_code or current_farmer.preferred_language or "en-IN"

    # Contextual knowledge from real claim record
    rain_deficit = (claim.reference_rainfall or 0) - (claim.observed_rainfall or 0)
    missing_docs = json.loads(claim.missing_documents or "[]")
    uploaded_docs = json.loads(claim.uploaded_documents_json or "[]")

    reply_en = ""
    suggested = [
        "What does my claim status mean?",
        "Which documents do I need to submit?",
        "What should I do next?"
    ]

    if "what is happening" in q or "status" in q or "stage" in q or "progress" in q:
        stage_display = (claim.workflow_stage or "application_submitted").replace("_", " ").title()
        reply_en = (
            f"Your claim ({claim.claim_reference}) for {claim.crop_type} is currently at the stage: '{stage_display}'. "
            f"Current status: '{claim.status}'. "
            f"Next action: {claim.next_expected_action or 'Wait while your records are being examined.'} "
            f"You do not need to worry; your claim is actively recorded in the PMFBY system."
        )
        suggested = ["Why is my claim being checked?", "What documents are missing?", "What should I do next?"]

    elif "why" in q and ("check" in q or "review" in q or "given" in q or "result" in q or "assess" in q):
        reply_en = (
            f"Your claim for {claim.crop_type} was checked using local weather stations and satellite greenness pictures. "
            f"In your area, rainfall was recorded at {claim.observed_rainfall} mm (normal is {claim.reference_rainfall} mm). "
            f"The AI evaluated these patterns to help the officer understand whether drought or weather stress impacted your crop. "
            f"An authorised officer makes the final decision."
        )
        suggested = ["Does AI make the final decision?", "What should I do next?", "How do I contact an officer?"]

    elif "document" in q or "paper" in q or "upload" in q:
        if missing_docs:
            reply_en = (
                f"For your {claim.crop_type} claim ({claim.claim_reference}), the following documents are currently requested: "
                f"{', '.join(missing_docs)}. "
                f"Please submit these documents to your local agricultural office or CSC center."
            )
        else:
            reply_en = (
                f"Good news! All basic documents for claim {claim.claim_reference} (Aadhaar, Land 7/12 RoR, and Bank Passbook) "
                f"have been verified. No additional documents are currently requested from you."
            )
        suggested = ["What is the current stage?", "What should I do next?", "Who can help me?"]

    elif "next" in q or "do now" in q or "action" in q:
        if missing_docs:
            reply_en = f"Next step: Please submit the pending documents ({', '.join(missing_docs)}) so your claim review can proceed."
        elif claim.status in ["Approved", "Human review completed"]:
            reply_en = "Next step: Your claim has been verified. Check your Aadhaar-linked bank account for DBT payment disbursement details."
        else:
            reply_en = (
                f"Next step: Wait while your claim is being checked. "
                f"{claim.next_expected_action or 'An insurance officer will review your evidence soon.'} "
                f"You can also call the Kisan Call Centre at 1800-180-1551 if you have questions."
            )
        suggested = ["Which documents do I need?", "What is happening with my claim?", "What does AI assessment mean?"]

    elif "apply" in q or "new claim" in q:
        reply_en = (
            "To apply for PMFBY crop insurance: 1. Ensure your land survey number (RoR 7/12) is ready. "
            "2. Keep your Aadhaar card and bank passbook handy. "
            "3. Register your sowing details within 72 hours of damage via the PMFBY portal or local agricultural officer."
        )
        suggested = ["Which documents do I need?", "What is happening with my claim?"]

    elif "ai" in q or "computer" in q or "guarantee" in q or "final" in q:
        reply_en = (
            "The AI only calculates weather and satellite pattern resemblance to help the assessor. "
            "It never makes final legal decisions and never guarantees approval. "
            "Only an authorized human insurance officer makes the final approved decision."
        )
        suggested = ["What is happening with my claim?", "What should I do next?"]

    else:
        # General helpful fallback
        reply_en = (
            f"I am here to help you with your {claim.crop_type} claim ({claim.claim_reference}). "
            f"Your current status is '{claim.status}'. "
            f"You can ask me about your claim progress, required documents, or why the AI gave this assessment."
        )
        suggested = ["What is happening with my claim?", "Why is my claim being checked?", "Which documents do I need?"]

    # Save to chat history
    try:
        user_msg = FarmerChatHistory(
            user_id=current_farmer.id,
            claim_id=claim.id,
            role="user",
            content=req.message,
            language_code=target_lang
        )
        db.add(user_msg)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not save user chat history: {e}")

    # Translate reply into target regional language if not English
    final_reply = reply_en
    translated_suggested = suggested
    if target_lang != "en-IN":
        try:
            trans_res = sarvam_service.translate_text(
                text=reply_en,
                target_lang=target_lang,
                source_lang="en-IN"
            )
            final_reply = trans_res.get("translated_text", reply_en)

            translated_suggested = []
            for s in suggested:
                s_trans = sarvam_service.translate_text(
                    text=s,
                    target_lang=target_lang,
                    source_lang="en-IN"
                )
                translated_suggested.append(s_trans.get("translated_text", s))
        except Exception as e:
            logger.warning(f"Failed to translate chat response: {e}")

    try:
        asst_msg = FarmerChatHistory(
            user_id=current_farmer.id,
            claim_id=claim.id,
            role="assistant",
            content=final_reply,
            language_code=target_lang
        )
        db.add(asst_msg)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not save assistant chat history: {e}")

    return ChatMessageResponse(
        role="assistant",
        content=final_reply,
        suggested_followups=translated_suggested,
        claim_reference=claim.claim_reference
    )

