from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
import json

from backend.app.database.session import get_db
from backend.app.database.models import Claim, ClaimAssessment, TrainedModel, HumanReview, AuditEvent
from backend.app.schemas.dashboard import DashboardSummaryResponse, DashboardChartsResponse, ChartDataPoint
from backend.app.ml.shap_explainer import ShapExplanationService

router = APIRouter()

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_claims = db.query(Claim).count()
    awaiting_review = db.query(Claim).filter(Claim.status.in_(["Submitted", "Awaiting human review", "Model assessed"])).count()
    model_assessed = db.query(ClaimAssessment).count()
    requiring_evidence = db.query(Claim).filter(Claim.status == "Additional evidence required").count()
    human_reviewed = db.query(HumanReview).count()

    demo_claims = db.query(Claim).filter(Claim.is_demo_record == True).count()
    is_demo = demo_claims > 0 or total_claims == 0

    return DashboardSummaryResponse(
        total_claims=total_claims,
        claims_awaiting_review=awaiting_review,
        claims_model_assessed=model_assessed,
        claims_requiring_evidence=requiring_evidence,
        claims_human_reviewed=human_reviewed,
        is_demo_data=is_demo,
        demo_banner_message="DEMO DATA — Illustrative records, not real farmer claims." if is_demo else ""
    )

@router.get("/dashboard/charts", response_model=DashboardChartsResponse)
def get_dashboard_charts(db: Session = Depends(get_db)):
    # A. Status Distribution
    status_counts = db.query(Claim.status, func.count(Claim.id)).group_by(Claim.status).all()
    status_data = [ChartDataPoint(name=s or "Draft", value=float(c)) for s, c in status_counts]

    # B. Claims Over Time (by sowing/creation date or month)
    # Using sowing date or creation date grouped by day/month
    time_records = db.query(func.date(Claim.created_at), func.count(Claim.id)).group_by(func.date(Claim.created_at)).all()
    time_data = [ChartDataPoint(name=str(d), value=float(c)) for d, c in time_records]
    if not time_data:
        time_data = [ChartDataPoint(name=Claim.sowing_date, value=1.0) for _ in range(0)]

    # C. Prediction Distribution
    pred_counts = db.query(ClaimAssessment.prediction_label, func.count(ClaimAssessment.id)).group_by(ClaimAssessment.prediction_label).all()
    prediction_data = [ChartDataPoint(name=p or "Pending", value=float(c)) for p, c in pred_counts]

    # D. Crop Distribution
    crop_counts = db.query(Claim.crop_type, func.count(Claim.id)).group_by(Claim.crop_type).all()
    crop_data = [ChartDataPoint(name=crop or "Other", value=float(c)) for crop, c in crop_counts]

    # E. Region / State Distribution
    state_counts = db.query(Claim.state, func.count(Claim.id)).group_by(Claim.state).all()
    region_data = [ChartDataPoint(name=st or "Other", value=float(c)) for st, c in state_counts]

    # F. Top Model Features from active model
    top_features = []
    active_model = db.query(TrainedModel).filter(TrainedModel.is_active == True).first()
    if not active_model:
        active_model = db.query(TrainedModel).order_by(desc(TrainedModel.created_at)).first()

    if active_model:
        try:
            service = ShapExplanationService(active_model.file_path)
            global_importance = service.explain_global(max_display=6)
            top_features = [
                ChartDataPoint(name=item["name"], value=item["importance"])
                for item in global_importance
            ]
        except Exception:
            top_features = []

    # G. Data Quality Summary
    claims = db.query(Claim).all()
    total_flags = 0
    flag_breakdown: Dict[str, int] = {}
    for cl in claims:
        flags = json.loads(cl.data_quality_flags or "[]")
        total_flags += len(flags)
        for f in flags:
            key = f.split("(")[0].strip() if "(" in f else f[:30]
            flag_breakdown[key] = flag_breakdown.get(key, 0) + 1

    dq_summary = {
        "total_claims_checked": len(claims),
        "claims_with_warnings": sum(1 for cl in claims if len(json.loads(cl.data_quality_flags or "[]")) > 0),
        "total_warnings_detected": total_flags,
        "warning_types": flag_breakdown
    }

    # H. Recent Activity
    recent_events = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(8).all()
    activity_list = [
        {
            "id": ev.id,
            "event_type": ev.event_type,
            "actor": ev.actor,
            "details": ev.details,
            "timestamp": ev.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for ev in recent_events
    ]

    return DashboardChartsResponse(
        status_distribution=status_data,
        claims_over_time=time_data,
        prediction_distribution=prediction_data,
        crop_distribution=crop_data,
        region_distribution=region_data,
        top_model_features=top_features,
        data_quality_summary=dq_summary,
        recent_activity=activity_list
    )


@router.get("/dashboard/claims-by-status")
def get_claims_by_status(db: Session = Depends(get_db)):
    total = db.query(Claim).count() or 1
    status_counts = db.query(Claim.status, func.count(Claim.id)).group_by(Claim.status).all()
    return [
        {
            "status": s or "Draft",
            "count": c,
            "percentage": round((c / total) * 100, 2)
        }
        for s, c in status_counts
    ]


@router.get("/dashboard/claims-over-time")
def get_claims_over_time(db: Session = Depends(get_db)):
    time_records = db.query(func.date(Claim.created_at), func.count(Claim.id)).group_by(func.date(Claim.created_at)).all()
    return [
        {
            "date": str(d),
            "claims_count": c
        }
        for d, c in time_records
    ]


@router.get("/dashboard/crop-analysis")
def get_crop_analysis(db: Session = Depends(get_db)):
    crop_stats = db.query(
        Claim.crop_type,
        func.count(Claim.id),
        func.avg(Claim.reported_loss_pct),
        func.avg(Claim.cultivated_area)
    ).group_by(Claim.crop_type).all()

    return [
        {
            "crop": crop or "Other",
            "claims_count": count,
            "avg_reported_loss_pct": round(float(avg_loss), 2) if avg_loss is not None else 0.0,
            "avg_cultivated_area": round(float(avg_area), 2) if avg_area is not None else 0.0
        }
        for crop, count, avg_loss, avg_area in crop_stats
    ]


@router.get("/dashboard/region-analysis")
def get_region_analysis(db: Session = Depends(get_db)):
    state_stats = db.query(
        Claim.state,
        func.count(Claim.id),
        func.avg(Claim.cultivated_area)
    ).group_by(Claim.state).all()

    return [
        {
            "state": st or "Other",
            "claims_count": count,
            "avg_cultivated_area": round(float(avg_area), 2) if avg_area is not None else 0.0
        }
        for st, count, avg_area in state_stats
    ]


@router.get("/dashboard/model-performance")
def get_dashboard_model_performance(db: Session = Depends(get_db)):
    models = db.query(TrainedModel).order_by(desc(TrainedModel.created_at)).all()
    active_clf = db.query(TrainedModel).filter(TrainedModel.task_type == "classification", TrainedModel.is_active == True).first()
    active_reg = db.query(TrainedModel).filter(TrainedModel.task_type == "regression", TrainedModel.is_active == True).first()

    def parse_metrics(m):
        if not m:
            return None
        metrics = json.loads(m.metrics_json or "{}")
        return {
            "id": m.id,
            "name": m.model_name,
            "version": m.model_version,
            "algorithm": m.algorithm,
            "task_type": m.task_type,
            "metrics": metrics,
            "dataset_name": m.dataset_name,
            "is_synthetic": m.is_synthetic_trained
        }

    return {
        "active_classification_model": parse_metrics(active_clf),
        "active_regression_model": parse_metrics(active_reg),
        "total_models": len(models),
        "models": [parse_metrics(m) for m in models]
    }


@router.get("/dashboard/recent-activity")
def get_dashboard_recent_activity(limit: int = 15, db: Session = Depends(get_db)):
    events = db.query(AuditEvent).order_by(desc(AuditEvent.timestamp)).limit(limit).all()
    return [
        {
            "id": ev.id,
            "event_type": ev.event_type,
            "actor": ev.actor,
            "details": ev.details,
            "claim_id": ev.claim_id,
            "timestamp": ev.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        for ev in events
    ]


