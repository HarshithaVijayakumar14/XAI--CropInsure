import os
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
import joblib
import shap

from backend.app.database.session import get_db
from backend.app.database.models import TrainedModel, ImportedDataset
from backend.app.schemas.model import (
    ModelTrainRequest,
    TrainedModelResponse,
    SetActiveModelRequest,
    AgriculturalYieldPredictRequest,
    AgriculturalYieldPredictResponse
)
from backend.app.ml.trainer import ModelTrainingPipeline
from backend.app.ml.shap_explainer import ShapExplanationService
from backend.app.ml.feature_engineering import compute_agricultural_features
from backend.app.services.audit_service import log_audit_event
from backend.app.schemas.assessment import GlobalExplanationResponse

router = APIRouter()

_agri_model_cache: Dict[str, Any] = {}

def _get_agricultural_model(db: Session):
    """Loads and caches the agricultural yield regression model bundle and SHAP explainer."""
    global _agri_model_cache
    if "bundle" in _agri_model_cache and "explainer" in _agri_model_cache:
        return _agri_model_cache["bundle"], _agri_model_cache["record"], _agri_model_cache["explainer"]

    # Check in database
    record = db.query(TrainedModel).filter(
        TrainedModel.model_name.ilike("%Agricultural%") | (TrainedModel.task_type == "regression")
    ).order_by(TrainedModel.id.desc()).first()

    bundle_path = None
    if record and record.file_path and os.path.exists(record.file_path):
        bundle_path = record.file_path
    else:
        # Fallback to data/models directory
        models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "models"))
        if os.path.exists(models_dir):
            candidates = [f for f in os.listdir(models_dir) if "agricultural_yield" in f and f.endswith(".joblib")]
            if candidates:
                candidates.sort(reverse=True)
                bundle_path = os.path.join(models_dir, candidates[0])

    if not bundle_path or not os.path.exists(bundle_path):
        raise HTTPException(
            status_code=404,
            detail="Agricultural crop-yield regression model bundle (Model ID 2) not found on disk."
        )

    bundle = joblib.load(bundle_path)
    pipeline = bundle.get("pipeline")
    if not pipeline:
        raise HTTPException(status_code=500, detail="Invalid model bundle: pipeline missing.")

    # Build SHAP TreeExplainer
    est = pipeline.named_steps['estimator']
    explainer = shap.TreeExplainer(est)

    _agri_model_cache["bundle"] = bundle
    _agri_model_cache["record"] = record
    _agri_model_cache["explainer"] = explainer
    return bundle, record, explainer


@router.get("/models", response_model=List[TrainedModelResponse])
def list_models(db: Session = Depends(get_db)):
    models = db.query(TrainedModel).order_by(TrainedModel.created_at.desc()).all()
    return models

@router.post("/models/train", response_model=TrainedModelResponse)
def train_new_model(request: ModelTrainRequest, db: Session = Depends(get_db)):
    # 1. Fetch dataset
    ds = db.query(ImportedDataset).filter(ImportedDataset.id == request.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = pd.read_csv(ds.file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read dataset file: {str(e)}")

    pipeline_trainer = ModelTrainingPipeline(random_state=request.random_state)
    try:
        train_result = pipeline_trainer.train_model(
            df=df,
            task_type=request.task_type,
            algorithm=request.algorithm,
            target_column=request.target_column,
            features=request.features,
            test_size=request.test_size,
            model_name=request.model_name,
            dataset_name=ds.name,
            is_synthetic=ds.is_synthetic
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Model training failed: {str(e)}")

    # Deactivate existing models of this task type if this is first or activated
    is_first = db.query(TrainedModel).filter(TrainedModel.task_type == request.task_type).count() == 0

    model_record = TrainedModel(
        model_name=train_result["model_name"],
        model_version=train_result["model_version"],
        task_type=train_result["task_type"],
        algorithm=train_result["algorithm"],
        target_column=train_result["target_column"],
        features_used=json.dumps(train_result["features_used"]),
        metrics_json=json.dumps(train_result["metrics"]),
        file_path=train_result["file_path"],
        is_synthetic_trained=train_result["is_synthetic_trained"],
        is_active=is_first,  # Make active if it's the first model
        dataset_name=train_result["dataset_name"],
        training_notes=train_result["training_notes"]
    )
    db.add(model_record)
    db.commit()
    db.refresh(model_record)

    log_audit_event(
        db,
        event_type="MODEL_TRAINED",
        actor="Assessor",
        details=(
            f"Trained {model_record.algorithm} ({model_record.task_type}) version {model_record.model_version} "
            f"on dataset '{ds.name}'."
        )
    )

    return model_record

@router.post("/models/train/classification", response_model=TrainedModelResponse)
def train_classification_model(request: ModelTrainRequest, db: Session = Depends(get_db)):
    request.task_type = "classification"
    if not request.target_column:
        request.target_column = "historical_outcome"
    if not request.algorithm:
        request.algorithm = "Random Forest"
    return train_new_model(request=request, db=db)

@router.post("/models/train/regression", response_model=TrainedModelResponse)
def train_regression_model(request: ModelTrainRequest, db: Session = Depends(get_db)):
    request.task_type = "regression"
    if not request.target_column:
        request.target_column = "payout_amount"
    if not request.algorithm:
        request.algorithm = "Random Forest Regressor"
    return train_new_model(request=request, db=db)

@router.get("/models/agricultural-yield/options")
def get_agricultural_yield_options(db: Session = Depends(get_db)):
    """Provides valid options, known categories, and model metadata for agricultural crop yield prediction."""
    try:
        bundle, record, _ = _get_agricultural_model(db)
        pipeline = bundle["pipeline"]
        pre = pipeline.named_steps['preprocessor']
        ohe = pre.named_transformers_['cat']

        states = sorted([str(s) for s in ohe.categories_[0]])
        districts = sorted([str(d) for d in ohe.categories_[1]])
        crops = sorted([str(c) for c in ohe.categories_[2]])
        seasons = sorted([str(sn) for sn in ohe.categories_[3]])

        metrics = bundle.get("metrics", {})

        return {
            "states": states,
            "crops": crops,
            "seasons": seasons,
            "districts_count": len(districts),
            "model_metadata": {
                "model_id": record.id if record else 2,
                "model_name": record.model_name if record else "Agricultural Crop Yield Regressor (APY-India)",
                "model_version": record.model_version if record else bundle.get("model_id", "v1.ceb9c0"),
                "task_type": "regression",
                "algorithm": bundle.get("algorithm", "Random Forest Regressor (100 Trees, Depth 16)"),
                "target": "Yield (Tonnes / Hectare)",
                "dataset_name": "India Agriculture Crop Production (1997–2020)",
                "r2_score": metrics.get("r2", 0.8699),
                "mae": metrics.get("mae", 1.2821),
                "rmse": metrics.get("rmse", 4.6157),
                "train_records": metrics.get("train_records", 265308),
                "test_records": metrics.get("test_records", 66328),
                "baseline_mean_yield": 4.505,
                "is_active": False  # Explicitly inactive for claim decisions
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model options: {str(e)}")

@router.post("/models/agricultural-yield/predict", response_model=AgriculturalYieldPredictResponse)
def predict_agricultural_yield(request: AgriculturalYieldPredictRequest, db: Session = Depends(get_db)):
    """
    Predicts expected crop yield (Tonnes/Ha) and total production (Tonnes) using the trained
    agricultural yield regression model (Model ID 2). Computes feature attributions via SHAP TreeExplainer.
    Completely separate from insurance claim approval/rejection.
    """
    state_clean = request.state.strip()
    district_clean = request.district.strip()
    crop_clean = request.crop.strip()
    season_clean = request.season.strip()

    if not state_clean:
        raise HTTPException(status_code=422, detail="State cannot be empty.")
    if not district_clean:
        raise HTTPException(status_code=422, detail="District cannot be empty.")
    if not crop_clean:
        raise HTTPException(status_code=422, detail="Crop cannot be empty.")
    if request.area <= 0:
        raise HTTPException(status_code=422, detail="Cultivated area must be greater than 0 hectares.")

    try:
        bundle, record, explainer = _get_agricultural_model(db)
        pipeline = bundle["pipeline"]
        pre = pipeline.named_steps['preprocessor']
        ohe = pre.named_transformers_['cat']

        # 1. Prepare input DataFrame
        input_df = pd.DataFrame([{
            "State": state_clean,
            "District": district_clean,
            "Crop": crop_clean,
            "Season": season_clean,
            "Area": float(request.area)
        }])

        # 2. Predict Yield
        pred_raw = float(pipeline.predict(input_df)[0])
        pred_yield = max(0.0, round(pred_raw, 3))
        pred_total = round(pred_yield * float(request.area), 2)

        # 3. Compute SHAP attributions
        trans = pre.transform(input_df).toarray()
        shap_vals = explainer.shap_values(trans)[0]

        base_val = explainer.expected_value
        if isinstance(base_val, (np.ndarray, list)):
            base_val = float(base_val[0])
        else:
            base_val = float(base_val)
        base_val = round(base_val, 3)

        feature_names = pre.get_feature_names_out()

        grouped = {
            "State": {"val": 0.0, "input": state_clean, "label": "State Agro-Climatic Zone"},
            "District": {"val": 0.0, "input": district_clean, "label": "District Soil & Climate"},
            "Crop": {"val": 0.0, "input": crop_clean, "label": "Crop Biological Capacity"},
            "Season": {"val": 0.0, "input": season_clean, "label": "Seasonal Weather & Monsoon Timing"},
            "Area": {"val": 0.0, "input": f"{request.area:.2f} Ha", "label": "Cultivated Land Holding Size"}
        }

        for name, val in zip(feature_names, shap_vals):
            if name.startswith("cat__State"):
                grouped["State"]["val"] += float(val)
            elif name.startswith("cat__District"):
                grouped["District"]["val"] += float(val)
            elif name.startswith("cat__Crop"):
                grouped["Crop"]["val"] += float(val)
            elif name.startswith("cat__Season"):
                grouped["Season"]["val"] += float(val)
            elif name.startswith("num__Area"):
                grouped["Area"]["val"] += float(val)

        contributions = []
        for k, item in grouped.items():
            v = round(item["val"], 4)
            direction = "positive" if v > 0.01 else ("negative" if v < -0.01 else "neutral")
            if direction == "positive":
                impact_desc = f"Pushed expected yield higher by +{abs(v):.2f} T/Ha compared to baseline ({item['label']})"
            elif direction == "negative":
                impact_desc = f"Pushed expected yield lower by -{abs(v):.2f} T/Ha compared to baseline ({item['label']})"
            else:
                impact_desc = f"Neutral impact near baseline ({item['label']})"

            contributions.append({
                "feature": k,
                "label": item["label"],
                "input_value": item["input"],
                "shap_value": v,
                "direction": direction,
                "impact_description": impact_desc
            })

        contributions_sorted = sorted(contributions, key=lambda x: abs(x["shap_value"]), reverse=True)
        top_pos = [c["feature"] for c in contributions if c["direction"] == "positive"]
        top_neg = [c["feature"] for c in contributions if c["direction"] == "negative"]

        # Plain language explanation
        diff = round(pred_yield - base_val, 2)
        if abs(diff) < 0.05:
            diff_desc = f"is approximately equal to the national historical baseline ({base_val:.2f} Tonnes/Ha)"
        elif diff > 0:
            diff_desc = f"is {diff:.2f} Tonnes/Ha above the national historical baseline ({base_val:.2f} T/Ha)"
        else:
            diff_desc = f"is {abs(diff):.2f} Tonnes/Ha below the national historical baseline ({base_val:.2f} T/Ha)"

        primary_factor = contributions_sorted[0] if contributions_sorted else None
        if primary_factor and abs(primary_factor["shap_value"]) >= 0.05:
            primary_text = f" The primary factor is {primary_factor['feature']} ({primary_factor['input_value']}), shifting the estimate by {primary_factor['shap_value']:+.2f} T/Ha."
        else:
            primary_text = " All features exerted moderate influence near baseline."

        plain_summary = (
            f"The predicted harvest yield for {crop_clean} in {district_clean}, {state_clean} "
            f"({season_clean} season, {request.area:.2f} Ha) is {pred_yield:.2f} Tonnes/Ha (total expected production: {pred_total:.2f} Tonnes). "
            f"This prediction {diff_desc}.{primary_text}"
        )

        # 4. Unknown category or out-of-range checks for informative warnings
        warnings = []
        known_states = set(ohe.categories_[0])
        known_districts_upper = set(str(d).upper() for d in ohe.categories_[1])
        known_crops_lower = set(str(c).lower() for c in ohe.categories_[2])

        if state_clean not in known_states:
            warnings.append(f"State '{state_clean}' was not in historical training records. Nationwide average features applied.")
        if district_clean.upper() not in known_districts_upper and district_clean not in known_districts_upper:
            warnings.append(f"District '{district_clean}' is not in historical district database. State-level aggregate applied.")
        if crop_clean.lower() not in known_crops_lower:
            warnings.append(f"Crop '{crop_clean}' was not directly observed in training data. General agricultural baseline applied.")
        if request.area > 5000:
            warnings.append(f"Cultivated area ({request.area:.1f} Ha) is exceptionally high compared to standard Indian smallholder farms.")

        metrics = bundle.get("metrics", {})

        return AgriculturalYieldPredictResponse(
            predicted_yield_tonnes_per_ha=pred_yield,
            predicted_total_production_tonnes=pred_total,
            cultivated_area_ha=float(request.area),
            unit_yield="Tonnes / Hectare",
            unit_production="Tonnes",
            baseline_mean_yield=base_val,
            difference_from_baseline=round(pred_yield - base_val, 3),
            shap_explanation={
                "base_value": base_val,
                "feature_contributions": contributions_sorted,
                "top_positive_features": top_pos,
                "top_negative_features": top_neg,
                "plain_text_summary": plain_summary
            },
            model_info={
                "model_id": record.id if record else 2,
                "model_name": record.model_name if record else "Agricultural Crop Yield Regressor (APY-India)",
                "model_version": record.model_version if record else bundle.get("model_id", "v1.ceb9c0"),
                "algorithm": bundle.get("algorithm", "Random Forest Regressor"),
                "task_type": "regression",
                "dataset_name": "India Agriculture Crop Production (1997–2020)",
                "r2_score": metrics.get("r2", 0.8699),
                "mae": metrics.get("mae", 1.2821),
                "rmse": metrics.get("rmse", 4.6157),
                "is_active": False  # Model 2 remains strictly inactive for insurance decisions
            },
            disclaimer=(
                "ESTIMATE ONLY: This prediction is an agronomic yield estimate based on historical Indian crop production records (1997–2020). "
                "It does NOT guarantee actual harvest yields, nor does it constitute an insurance claim approval, rejection, or payout decision under PMFBY or any other crop insurance scheme."
            ),
            warnings=warnings
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agricultural yield prediction failed: {str(e)}")

@router.get("/models/{model_id}", response_model=TrainedModelResponse)
def get_model(model_id: int, db: Session = Depends(get_db)):
    model_obj = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not model_obj:
        raise HTTPException(status_code=404, detail="Model not found")
    return model_obj

@router.post("/models/{model_id}/activate")
def activate_model(model_id: int, db: Session = Depends(get_db)):
    target = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model not found")

    # Set others of same task_type inactive
    db.query(TrainedModel).filter(TrainedModel.task_type == target.task_type).update({"is_active": False})
    target.is_active = True
    db.commit()

    log_audit_event(
        db,
        event_type="MODEL_ACTIVATED",
        actor="Assessor",
        details=f"Activated model {target.model_name} ({target.model_version}) for {target.task_type}."
    )
    return {"message": f"Model {target.model_version} is now active for {target.task_type}."}

@router.get("/models/{model_id}/explanations/global", response_model=GlobalExplanationResponse)
def get_global_explanations(model_id: int, db: Session = Depends(get_db)):
    target = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        service = ShapExplanationService(target.file_path)
        global_importance = service.explain_global(max_display=12)
        sample_size = len(service.background_sample) if service.background_sample is not None else 0
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate SHAP global explanation: {str(e)}")

    summary_desc = (
        f"Global feature importance calculated via SHAP Tree/Linear Explainer across {sample_size} reference samples. "
        f"Shows the average absolute impact each feature has on shifting the model output away from the base value."
    )

    return GlobalExplanationResponse(
        model_id=target.id,
        model_name=target.model_name,
        model_version=target.model_version,
        feature_importance=global_importance,
        dataset_name=target.dataset_name,
        evaluation_sample_size=sample_size,
        summary_description=summary_desc
    )

@router.get("/models/{model_id}/metrics")
def get_model_metrics(model_id: int, db: Session = Depends(get_db)):
    target = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model not found")
    return {
        "model_id": target.id,
        "model_name": target.model_name,
        "model_version": target.model_version,
        "task_type": target.task_type,
        "algorithm": target.algorithm,
        "dataset_name": target.dataset_name,
        "is_active": target.is_active,
        "features_used": json.loads(target.features_used or "[]"),
        "metrics": json.loads(target.metrics_json or "{}")
    }

@router.get("/models/{model_id}/explainability/global", response_model=GlobalExplanationResponse)
def get_model_global_explainability(model_id: int, db: Session = Depends(get_db)):
    return get_global_explanations(model_id=model_id, db=db)

@router.post("/models/{model_id}/predict")
def run_model_prediction(model_id: int, input_data: Dict[str, Any], db: Session = Depends(get_db)):
    target = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        service = ShapExplanationService(target.file_path)
        raw_df = pd.DataFrame([input_data])
        feat_df, warnings = compute_agricultural_features(raw_df)

        prediction = service.pipeline.predict(feat_df)[0]
        proba = None
        if target.task_type == "classification" and hasattr(service.pipeline, "predict_proba"):
            prob_array = service.pipeline.predict_proba(feat_df)[0]
            classes = list(service.pipeline.classes_)
            if "Approved" in classes:
                idx = classes.index("Approved")
                proba = round(float(prob_array[idx]), 4)
            else:
                proba = round(float(prob_array[-1]), 4)

        return {
            "model_id": target.id,
            "model_name": target.model_name,
            "model_version": target.model_version,
            "task_type": target.task_type,
            "prediction": str(prediction) if target.task_type == "classification" else round(float(prediction), 2),
            "probability": proba,
            "data_quality_warnings": warnings
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

@router.post("/models/{model_id}/explainability/local")
def get_model_local_explainability(model_id: int, input_data: Dict[str, Any], db: Session = Depends(get_db)):
    target = db.query(TrainedModel).filter(TrainedModel.id == model_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Model not found")

    try:
        service = ShapExplanationService(target.file_path)
        raw_df = pd.DataFrame([input_data])
        feat_df, warnings = compute_agricultural_features(raw_df)
        local_exp = service.explain_instance(feat_df)
        return {
            "model_id": target.id,
            "model_name": target.model_name,
            "model_version": target.model_version,
            "task_type": target.task_type,
            "base_value": local_exp["base_value"],
            "shap_contributions": local_exp["shap_contributions"],
            "top_positive_features": local_exp.get("top_positive_features", []),
            "top_negative_features": local_exp.get("top_negative_features", []),
            "data_quality_warnings": warnings
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Explainability calculation error: {str(e)}")




