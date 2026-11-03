import os
import json
import pytest
import os
import json
import pytest
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from backend.app.database.session import Base, get_db, SessionLocal
from backend.app.database.models import Claim, TrainedModel, ImportedDataset
from backend.app.schemas.claim import ClaimCreate, ClaimUpdate
from backend.app.schemas.review import ReviewCreateRequest
from backend.app.schemas.assessment import AssessmentRequest
from backend.app.ml.feature_engineering import compute_agricultural_features, validate_claim_data_quality
from backend.app.ml.synthetic_generator import generate_synthetic_agricultural_data
from backend.app.ml.trainer import ModelTrainingPipeline
from backend.app.ml.shap_explainer import ShapExplanationService
from backend.app.services.explanation_service import FarmerFriendlyExplanationService
from backend.app.services.pdf_service import generate_claim_pdf_report
from backend.app.api import health, dashboard, claims, assessments, reviews, reports

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

# 1. Test Health
def test_health_endpoint(db):
    data = health.health_check(db)
    assert data["status"] == "healthy"
    assert data["database_connected"] is True
    assert "claims_registered" in data

# 2. Test Feature Engineering
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
    
    # 1000 - 400 = 600 mm deficit
    assert feat_df["rainfall_deficit"].iloc[0] == 600.0
    # (1000 - 400)/1000 = 0.60 relative deficit
    assert pytest.approx(feat_df["relative_rainfall_deficit"].iloc[0], 0.01) == 0.60
    # 0.35 - 0.65 = -0.30 ndvi change
    assert pytest.approx(feat_df["ndvi_change"].iloc[0], 0.01) == -0.30
    # 34 - 30 = +4.0 anomaly
    assert feat_df["temperature_anomaly"].iloc[0] == 4.0

def test_data_quality_validation():
    bad_claim = {
        "current_ndvi": 1.45, # out of range [-1, 1]
        "observed_rainfall": -20.0, # negative rain
        "cultivated_area": -1.5, # negative area
        "sowing_date": "2025-07-20",
        "claim_start_date": "2025-06-10" # start precedes sowing
    }
    flags = validate_claim_data_quality(bad_claim)
    assert len(flags) >= 4
    assert any("out of physical range" in f for f in flags)
    assert any("negative" in f for f in flags)
    assert any("precedes sowing" in f for f in flags)

# 3. Test Claim Creation & Retrieval
def test_claim_lifecycle(db):
    new_claim = ClaimCreate(
        farmer_name="Test Farmer Harish",
        policy_reference="POL-TEST-2026-001",
        insurance_scheme="Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        state="Maharashtra",
        district="Solapur",
        crop_type="Cotton",
        season="Kharif",
        sowing_date="2025-06-15",
        claim_start_date="2025-07-01",
        claim_end_date="2025-11-15",
        cultivated_area=2.0,
        observed_rainfall=310.0,
        reference_rainfall=850.0,
        soil_moisture=22.0,
        observed_temperature=35.5,
        reference_temperature=31.0,
        current_ndvi=0.38,
        reference_ndvi=0.68
    )
    # Create
    claim_data = claims.create_new_claim(new_claim, db=db)
    assert claim_data.farmer_name == "Test Farmer Harish"
    assert claim_data.claim_reference.startswith("CLM-")
    claim_id = claim_data.id

    # Get Single
    single = claims.get_single_claim(claim_id, db=db)
    assert single.district == "Solapur"

    # Update
    update_data = ClaimUpdate(cultivated_area=3.5)
    updated = claims.update_existing_claim(claim_id, update_data, db=db)
    assert updated.cultivated_area == 3.5

    # Run Assessment
    req = AssessmentRequest()
    assessment = assessments.run_claim_assessment(claim_id, request=req, db=db)
    assert assessment.prediction_label in ["Approved", "Rejected"]
    assert len(assessment.shap_contributions) > 0
    assert len(assessment.farmer_friendly_summary) > 20

    # Get Audit
    audit_events = reviews.get_claim_audit_history(claim_id, db=db)
    assert len(audit_events) >= 2 # CREATED, UPDATED, ASSESSMENT_RUN

    # Record Review
    review_payload = ReviewCreateRequest(
        reviewer_name="Senior Assessor Joshi",
        reviewer_role="Claim Assessor",
        review_decision="Approved",
        differs_from_model=False,
        rationale="Field CCE validation corroborates rainfall deficit and vegetative loss in Solapur tehsil."
    )
    review_res = reviews.record_human_review(claim_id, review_payload, db=db)
    assert review_res.review_decision == "Approved"

    # Download PDF Report
    pdf_res = reports.download_claim_report(claim_id, db=db)
    assert os.path.exists(pdf_res.path)
    assert os.path.getsize(pdf_res.path) > 1000

    # Export CSV
    csv_res = reports.export_claim_csv(claim_id, db=db)
    assert csv_res.status_code == 200
    assert "claim_reference" in csv_res.body.decode("utf-8")

# 4. Test Model Training & Evaluation
def test_model_training_and_shap():
    # Generate small dataset
    synth_df = generate_synthetic_agricultural_data(num_samples=100, random_seed=99)
    trainer = ModelTrainingPipeline(random_state=99)
    
    # Classification
    clf_res = trainer.train_model(
        df=synth_df,
        task_type="classification",
        algorithm="Random Forest",
        target_column="historical_outcome"
    )
    assert clf_res["metrics"]["accuracy"] > 0.70
    assert "confusion_matrix" in clf_res["metrics"]
    assert os.path.exists(clf_res["file_path"])

    # Test genuine SHAP Explainer
    explainer = ShapExplanationService(clf_res["file_path"])
    sample_row = synth_df.head(1).copy()
    feat_df, _ = compute_agricultural_features(sample_row)
    local_exp = explainer.explain_instance(feat_df)
    
    assert "base_value" in local_exp
    assert len(local_exp["shap_contributions"]) > 0
    top_contribution = local_exp["shap_contributions"][0]
    assert "feature_name_display" in top_contribution
    assert "shap_value" in top_contribution
    assert top_contribution["direction"] in ["positive", "negative", "neutral"]

    # Global SHAP
    global_exp = explainer.explain_global(max_display=5)
    assert len(global_exp) > 0
    assert "importance" in global_exp[0]

# 5. Test Regression Model (Payout Estimation)
def test_payout_regression_model():
    synth_df = generate_synthetic_agricultural_data(num_samples=100, random_seed=99)
    trainer = ModelTrainingPipeline(random_state=99)
    
    reg_res = trainer.train_model(
        df=synth_df,
        task_type="regression",
        algorithm="Random Forest Regressor",
        target_column="payout_amount"
    )
    assert "mae" in reg_res["metrics"]
    assert "rmse" in reg_res["metrics"]
    assert reg_res["metrics"]["mae"] >= 0.0

# 6. Test Dashboard Summary and Charts
def test_dashboard_apis(db):
    s_data = dashboard.get_dashboard_summary(db)
    assert s_data.total_claims > 0

    c_data = dashboard.get_dashboard_charts(db)
    assert len(c_data.status_distribution) > 0
    assert len(c_data.crop_distribution) > 0
    assert len(c_data.region_distribution) > 0
    assert len(c_data.top_model_features) > 0
    assert len(c_data.recent_activity) > 0

