import os
import sys
import json
import pytest
import pandas as pd
import numpy as np

from backend.app.database.session import SessionLocal, engine, Base
from backend.app.database.models import Claim, TrainedModel, ImportedDataset, ClaimAssessment, HumanReview, AuditEvent
from backend.app.schemas.claim import ClaimCreate, ClaimUpdate
from backend.app.schemas.review import ReviewCreateRequest
from backend.app.schemas.assessment import AssessmentRequest
from backend.app.schemas.model import ModelTrainRequest
from backend.app.ml.feature_engineering import compute_agricultural_features, validate_claim_data_quality
from backend.app.ml.synthetic_generator import generate_synthetic_agricultural_data
from backend.app.ml.trainer import ModelTrainingPipeline
from backend.app.ml.shap_explainer import ShapExplanationService
from backend.app.services.explanation_service import FarmerFriendlyExplanationService
from backend.app.services.pdf_service import generate_claim_pdf_report

from backend.app.api import (
    health,
    dashboard,
    claims,
    datasets,
    models,
    assessments,
    reviews,
    reports
)

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# 1. Health
def test_health_api(db):
    res = health.health_check(db)
    assert res["status"] == "healthy"
    assert res["database_connected"] is True
    assert res["claims_registered"] > 0
    assert res["models_trained"] > 0

# 2. Feature Engineering & Validation
def test_feature_engineering_math():
    raw_df = pd.DataFrame([{
        "reference_rainfall": 1000.0,
        "observed_rainfall": 400.0,
        "current_ndvi": 0.35,
        "reference_ndvi": 0.65,
        "observed_temperature": 34.0,
        "reference_temperature": 30.0
    }])
    feat_df, warnings = compute_agricultural_features(raw_df)
    assert feat_df["rainfall_deficit"].iloc[0] == 600.0
    assert pytest.approx(feat_df["relative_rainfall_deficit"].iloc[0], 0.01) == 0.60
    assert pytest.approx(feat_df["ndvi_change"].iloc[0], 0.01) == -0.30
    assert feat_df["temperature_anomaly"].iloc[0] == 4.0

def test_data_quality_flags():
    bad_data = {
        "current_ndvi": 1.5,
        "observed_rainfall": -10.0,
        "cultivated_area": -2.0,
        "sowing_date": "2025-07-20",
        "claim_start_date": "2025-06-10"
    }
    flags = validate_claim_data_quality(bad_data)
    assert len(flags) >= 4

# 3. Dashboard Endpoints (Summary, Charts, Granular)
def test_dashboard_apis(db):
    # Summary
    summary = dashboard.get_dashboard_summary(db)
    assert summary.total_claims > 0
    assert summary.is_demo_data is True

    # Charts
    charts = dashboard.get_dashboard_charts(db)
    assert len(charts.status_distribution) > 0
    assert len(charts.crop_distribution) > 0
    assert len(charts.region_distribution) > 0

    # Granular by-status
    by_status = dashboard.get_claims_by_status(db)
    assert len(by_status) > 0
    assert "status" in by_status[0]
    assert "count" in by_status[0]

    # Granular claims over time
    over_time = dashboard.get_claims_over_time(db)
    assert isinstance(over_time, list)

    # Granular crop analysis
    crops = dashboard.get_crop_analysis(db)
    assert len(crops) > 0
    assert "crop" in crops[0]

    # Granular region analysis
    regions = dashboard.get_region_analysis(db)
    assert len(regions) > 0
    assert "state" in regions[0]

    # Granular model performance
    m_perf = dashboard.get_dashboard_model_performance(db)
    assert m_perf["total_models"] > 0
    assert m_perf["active_classification_model"] is not None

    # Granular recent activity
    activity = dashboard.get_dashboard_recent_activity(limit=5, db=db)
    assert len(activity) > 0

# 4. Claims Lifecycle (Create, List, Get, Update, Delete)
def test_claim_crud_lifecycle(db):
    claim_in = ClaimCreate(
        farmer_name="Sanjay Rao",
        policy_reference="POL-TEST-CRUD-001",
        insurance_scheme="Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        state="Karnataka",
        district="Belagavi",
        village="Nipani",
        crop_type="Soybean",
        season="Kharif",
        sowing_date="2025-06-20",
        claim_start_date="2025-07-15",
        claim_end_date="2025-10-30",
        cultivated_area=2.5,
        observed_rainfall=340.0,
        reference_rainfall=750.0,
        soil_moisture=22.0,
        observed_temperature=33.0,
        reference_temperature=29.0,
        current_ndvi=0.38,
        reference_ndvi=0.64
    )
    # Create
    created = claims.create_new_claim(claim_in, db=db)
    assert created.id is not None
    assert created.farmer_name == "Sanjay Rao"
    claim_id = created.id

    # Get Single
    fetched = claims.get_single_claim(claim_id, db=db)
    assert fetched.district == "Belagavi"

    # List
    listing = claims.list_claims(skip=0, limit=10, db=db)
    assert listing["total"] > 0
    assert any(c.id == claim_id for c in listing["items"])

    # Update
    update_data = ClaimUpdate(cultivated_area=3.0)
    updated = claims.update_existing_claim(claim_id, update_data, db=db)
    assert updated.cultivated_area == 3.0

    # Clean up (Delete)
    del_res = claims.delete_claim(claim_id, db=db)
    assert "deleted successfully" in del_res["message"]

# 5. Assessment & SHAP Explainability
def test_assessment_and_shap(db):
    # Pick first available claim
    cl = db.query(Claim).first()
    assert cl is not None

    req = AssessmentRequest()
    ass_res = assessments.run_claim_assessment(cl.id, request=req, db=db)
    assert ass_res.prediction_label in ["Approved", "Rejected"]
    assert len(ass_res.shap_contributions) > 0
    assert len(ass_res.farmer_friendly_summary) > 10

    # Retrieve assessment GET
    get_res = assessments.get_claim_assessment(cl.id, db=db)
    assert get_res.id == ass_res.id

    # Explanation details
    exp_details = assessments.get_claim_explanation_details(cl.id, db=db)
    assert len(exp_details["contributions"]) > 0

# 6. Human Review & Audit Logging
def test_human_review_and_audit(db):
    cl = db.query(Claim).first()
    assert cl is not None

    rev_req = ReviewCreateRequest(
        reviewer_name="Officer Deshmukh",
        reviewer_role="Agricultural Officer",
        review_decision="Approved",
        differs_from_model=False,
        rationale="Satellite and field moisture data verify vegetative loss."
    )
    recorded = reviews.record_human_review(cl.id, rev_req, db=db)
    assert recorded.review_decision == "Approved"

    # Claim reviews list
    claim_reviews = reviews.get_claim_reviews(cl.id, db=db)
    assert len(claim_reviews) > 0

    # Audit events for claim
    audit_events = reviews.get_claim_audit_history(cl.id, db=db)
    assert len(audit_events) > 0

    # All audit events
    all_events = reviews.get_all_audit_events(limit=20, db=db)
    assert len(all_events) > 0

# 7. Model Training, Metrics, Predict, and Global Explainability
def test_models_api_and_training(db):
    all_models = models.list_models(db=db)
    assert len(all_models) > 0
    active_m = all_models[0]

    # Metrics
    metrics_resp = models.get_model_metrics(active_m.id, db=db)
    assert "accuracy" in metrics_resp["metrics"]

    # Global Explainability
    glob_resp = models.get_global_explanations(active_m.id, db=db)
    assert len(glob_resp.feature_importance) > 0

    # Model Predict endpoint
    input_sample = {
        "observed_rainfall": 280.0,
        "reference_rainfall": 800.0,
        "current_ndvi": 0.32,
        "reference_ndvi": 0.65,
        "observed_temperature": 35.0,
        "reference_temperature": 30.0,
        "cultivated_area": 2.0,
        "soil_moisture": 19.0,
        "crop_type": "Cotton",
        "season": "Kharif",
        "state": "Maharashtra"
    }
    pred_res = models.run_model_prediction(active_m.id, input_sample, db=db)
    assert "prediction" in pred_res
    assert pred_res["task_type"] == active_m.task_type

    # Model Local Explainability
    local_res = models.get_model_local_explainability(active_m.id, input_sample, db=db)
    assert "base_value" in local_res
    assert len(local_res["shap_contributions"]) > 0

# 8. Datasets API
def test_datasets_api(db):
    ds_list = datasets.list_datasets(db=db)
    assert len(ds_list) > 0
    ds = ds_list[0]

    # Dataset details
    details = datasets.get_dataset_details(ds.id, db=db)
    assert details["name"] == ds.name

    # Preview
    preview = datasets.get_dataset_preview(ds.id, limit=5, db=db)
    assert len(preview["rows"]) <= 5
    assert preview["total_rows"] > 0

# 9. PDF & CSV Reports
def test_reports_api(db):
    cl = db.query(Claim).first()
    assert cl is not None

    # CSV Export
    csv_res = reports.export_claim_csv(cl.id, db=db)
    assert csv_res.status_code == 200
    assert "claim_reference" in csv_res.body.decode("utf-8")

