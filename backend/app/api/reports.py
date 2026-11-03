import os
import json
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
import pandas as pd

from backend.app.database.session import get_db
from backend.app.database.models import Claim, ClaimAssessment, TrainedModel
from backend.app.services.claim_service import get_claim_by_id
from backend.app.services.pdf_service import generate_claim_pdf_report
from backend.app.services.audit_service import log_audit_event
from backend.app.config import settings

router = APIRouter()

@router.get("/claims/{claim_id}/report")
def download_claim_report(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim_id).order_by(desc(ClaimAssessment.assessed_at)).first()
    if not assessment:
        raise HTTPException(status_code=400, detail="Cannot generate report: Claim has not been assessed yet.")

    model = db.query(TrainedModel).filter(TrainedModel.id == assessment.model_id).first()
    contributions = json.loads(assessment.shap_values_json or "[]")

    filename = f"Claim_Report_{claim.claim_reference}.pdf"
    file_path = generate_claim_pdf_report(
        claim=claim,
        assessment=assessment,
        model=model,
        shap_contributions=contributions,
        output_filename=filename
    )

    log_audit_event(
        db,
        event_type="REPORT_DOWNLOADED",
        actor="Assessor",
        details=f"Generated and downloaded PDF assessment report for claim {claim.claim_reference}.",
        claim_id=claim.id
    )

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=filename
    )

@router.get("/claims/{claim_id}/export")
def export_claim_csv(claim_id: int, db: Session = Depends(get_db)):
    claim = get_claim_by_id(db=db, claim_id=claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    assessment = db.query(ClaimAssessment).filter(ClaimAssessment.claim_id == claim_id).order_by(desc(ClaimAssessment.assessed_at)).first()

    data = {
        "claim_reference": claim.claim_reference,
        "farmer_name": claim.farmer_name,
        "policy_reference": claim.policy_reference,
        "crop_type": claim.crop_type,
        "state": claim.state,
        "district": claim.district,
        "season": claim.season,
        "cultivated_area": claim.cultivated_area,
        "observed_rainfall": claim.observed_rainfall,
        "reference_rainfall": claim.reference_rainfall,
        "rainfall_deficit": claim.reference_rainfall - claim.observed_rainfall,
        "observed_temperature": claim.observed_temperature,
        "reference_temperature": claim.reference_temperature,
        "current_ndvi": claim.current_ndvi,
        "reference_ndvi": claim.reference_ndvi,
        "ndvi_change": claim.current_ndvi - claim.reference_ndvi,
        "status": claim.status,
        "prediction_label": assessment.prediction_label if assessment else "Not Assessed",
        "prediction_probability": assessment.prediction_probability if assessment else None,
        "payout_estimate": assessment.payout_estimate if assessment else None,
        "assessed_at": assessment.assessed_at.isoformat() if assessment else None
    }

    df = pd.DataFrame([data])
    output = io.StringIO()
    df.to_csv(output, index=False)
    csv_str = output.getvalue()

    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=claim_{claim.claim_reference}.csv"}
    )

