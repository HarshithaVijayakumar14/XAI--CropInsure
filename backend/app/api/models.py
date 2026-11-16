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

def _get_agricultural_model(db: Session, force_reload: bool = False):
    """Loads and caches the agricultural yield regression & classification model bundle and SHAP explainer."""
    global _agri_model_cache
    if not force_reload and "bundle" in _agri_model_cache and "explainer" in _agri_model_cache:
        return _agri_model_cache["bundle"], _agri_model_cache["record"], _agri_model_cache["explainer"]

    # Check in database for Model ID 2 or agricultural model
    record = db.query(TrainedModel).filter(
        (TrainedModel.id == 2) | TrainedModel.model_name.ilike("%Agricultural%") | (TrainedModel.task_type == "regression")
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
    reg_pipeline = bundle.get("regression_pipeline", bundle.get("pipeline"))
    if not reg_pipeline:
        raise HTTPException(status_code=500, detail="Invalid model bundle: regression pipeline missing.")

    # Build SHAP TreeExplainer
    est = reg_pipeline.named_steps['estimator']
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
    """Provides valid options, known categories, regional defaults, and model metadata for agricultural crop yield prediction."""
    try:
        bundle, record, _ = _get_agricultural_model(db)
        reg_pipeline = bundle.get("regression_pipeline", bundle.get("pipeline"))
        prep = reg_pipeline.named_steps.get('prep', reg_pipeline.named_steps.get('preprocessor'))
        ohe = prep.named_transformers_['cat']

        states = sorted([str(s) for s in ohe.categories_[0]])
        all_districts = sorted([str(d) for d in ohe.categories_[1]])
        crops = sorted([str(c) for c in ohe.categories_[2]])
        seasons = sorted([str(sn) for sn in ohe.categories_[3]])

        district_defaults = bundle.get("district_defaults", {})
        state_defaults = bundle.get("state_defaults", {})
        crop_thresholds = bundle.get("crop_thresholds", {})
        crop_baselines = bundle.get("crop_baseline_yields", {})

        # Group districts by state from genuine APY district database
        districts_by_state: Dict[str, List[str]] = {}
        for key in district_defaults.keys():
            if "|" in key:
                st, dist = key.split("|", 1)
                districts_by_state.setdefault(st, []).append(dist)
        for st in districts_by_state:
            districts_by_state[st].sort()

        # Build structured crop list with baseline and shortfall threshold
        crop_list = []
        for c in crops:
            crop_list.append({
                "crop_name": c,
                "historical_median_yield": crop_baselines.get(c, 2.0),
                "shortfall_threshold": crop_thresholds.get(c, 1.4),
                "unit": "Tonnes / Hectare"
            })

        metrics = bundle.get("metrics", {})

        return {
            "states": states,
            "districts_by_state": districts_by_state,
            "all_districts_count": len(all_districts),
            "crops": crop_list,
            "crop_names": crops,
            "seasons": seasons,
            "state_defaults": state_defaults,
            "district_defaults": district_defaults,
            "model_metadata": {
                "model_id": record.id if record else 2,
                "model_name": record.model_name if record else "Agricultural Crop Yield & Insurance Indication Engine (APY-IMD-v2)",
                "model_version": record.model_version if record else bundle.get("model_version", "v2.cdff65"),
                "task_type": "hybrid_yield_prediction",
                "algorithm": bundle.get("algorithm", "Dual Random Forest (Regressor & Balanced Classifier)"),
                "target": "Crop Yield (Tonnes / Hectare) & Expected Harvest (YES / NO)",
                "dataset_name": "Harmonized APY District Records + IMD Annual Rainfall + Patelris Surface Temperatures (1997–2020)",
                "training_records": bundle.get("training_records", 310813),
                "regression_metrics": {
                    "random_split_r2": metrics.get("regression_random_split", {}).get("r2", 0.9136),
                    "random_split_mae": metrics.get("regression_random_split", {}).get("mae", 1.0752),
                    "random_split_rmse": metrics.get("regression_random_split", {}).get("rmse", 3.8117),
                    "temporal_split_r2": metrics.get("regression_temporal_split", {}).get("r2", 0.8400),
                    "temporal_split_mae": metrics.get("regression_temporal_split", {}).get("mae", 1.6473),
                    "temporal_split_rmse": metrics.get("regression_temporal_split", {}).get("rmse", 5.2521)
                },
                "classification_metrics": {
                    "temporal_accuracy": metrics.get("classification_temporal_split", {}).get("accuracy", 0.7993),
                    "temporal_precision": metrics.get("classification_temporal_split", {}).get("precision", 0.8876),
                    "temporal_recall": metrics.get("classification_temporal_split", {}).get("recall", 0.8623),
                    "temporal_f1": metrics.get("classification_temporal_split", {}).get("f1_score", 0.8748),
                    "random_accuracy": metrics.get("classification_random_split", {}).get("accuracy", 0.7217),
                    "random_f1": metrics.get("classification_random_split", {}).get("f1_score", 0.7830)
                },
                "dataset_sources": bundle.get("dataset_sources", []),
                "is_active": False  # Strictly inactive for official claim approvals
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model options: {str(e)}")

@router.post("/models/agricultural-yield/predict", response_model=AgriculturalYieldPredictResponse)
def predict_agricultural_yield(request: AgriculturalYieldPredictRequest, db: Session = Depends(get_db)):
    """
    Predicts expected crop yield (Tonnes/Ha), total production (Tonnes), and harvest expectation (YES/NO)
    using the trained agricultural model (Model ID 2). Computes feature attributions via SHAP TreeExplainer.
    Provides clear insurance indication and farmer-friendly explanations.
    Completely separate from insurance claim approval/rejection decisions.
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
        reg_pipeline = bundle.get("regression_pipeline", bundle.get("pipeline"))
        clf_pipeline = bundle.get("classification_pipeline")

        prep = reg_pipeline.named_steps.get('prep', reg_pipeline.named_steps.get('preprocessor'))
        ohe = prep.named_transformers_['cat']

        district_defaults = bundle.get("district_defaults", {})
        state_defaults = bundle.get("state_defaults", {})
        crop_thresholds = bundle.get("crop_thresholds", {})
        crop_baselines = bundle.get("crop_baseline_yields", {})

        # 1. Determine regional environmental & agricultural input parameters
        dist_key = f"{state_clean}|{district_clean}"
        if dist_key in district_defaults:
            reg_vals = district_defaults[dist_key]
            provenance_level = f"Historical district median ({district_clean}, {state_clean})"
        elif state_clean in state_defaults:
            reg_vals = state_defaults[state_clean]
            provenance_level = f"Historical state median ({state_clean})"
        else:
            reg_vals = {
                "Annual_Rainfall": 1150.0,
                "Avg_Temp": 26.50,
                "Fertilizer_per_ha": 140.0,
                "Pesticide_per_ha": 0.45
            }
            provenance_level = "National agricultural historical baseline"

        rainfall_used = float(request.annual_rainfall) if request.annual_rainfall is not None else float(reg_vals["Annual_Rainfall"])
        rainfall_prov = "Farmer specified" if request.annual_rainfall is not None else provenance_level

        temp_used = float(request.avg_temperature) if request.avg_temperature is not None else float(reg_vals["Avg_Temp"])
        temp_prov = "Farmer specified" if request.avg_temperature is not None else provenance_level

        fert_used = float(request.fertilizer_per_ha) if request.fertilizer_per_ha is not None else float(reg_vals["Fertilizer_per_ha"])
        fert_prov = "Farmer specified" if request.fertilizer_per_ha is not None else provenance_level

        pest_used = float(request.pesticide_per_ha) if request.pesticide_per_ha is not None else float(reg_vals["Pesticide_per_ha"])
        pest_prov = "Farmer specified" if request.pesticide_per_ha is not None else provenance_level

        # 2. Build input DataFrame matching trained schema
        input_dict = {
            "State": state_clean,
            "District": district_clean,
            "Crop": crop_clean,
            "Season": season_clean,
            "Area": float(request.area),
            "Annual_Rainfall": rainfall_used,
            "Fertilizer_per_ha": fert_used,
            "Pesticide_per_ha": pest_used,
            "Avg_Temp": temp_used
        }
        input_df = pd.DataFrame([input_dict])

        # 3. Numerical Yield Prediction (Question 1)
        pred_raw = float(reg_pipeline.predict(input_df)[0])
        pred_yield = max(0.0, round(pred_raw, 3))
        pred_total = round(pred_yield * float(request.area), 2)

        # Baseline & crop thresholds
        crop_median = float(crop_baselines.get(crop_clean, round(pred_yield, 2)))
        crop_threshold = float(crop_thresholds.get(crop_clean, round(crop_median * 0.7, 3)))

        # 4. Binary Yield Expectation Prediction (Question 2: Will yield come or not?)
        if clf_pipeline is not None:
            pred_class = int(clf_pipeline.predict(input_df)[0])
            prob_arr = clf_pipeline.predict_proba(input_df)[0]
            prob_yes = float(prob_arr[1]) if len(prob_arr) > 1 else (1.0 if pred_class == 1 else 0.0)
        else:
            pred_class = 1 if pred_yield >= crop_threshold else 0
            prob_yes = 0.85 if pred_class == 1 else 0.25

        if pred_class == 1:
            yield_classification = "YES"
            yield_classification_label = "YES – CROP YIELD EXPECTED"
            confidence_prob = round(prob_yes, 4)
            insurance_indication = "Insurance claim is not indicated by the crop-yield prediction."
            insurance_indication_detail = (
                "The agricultural model projects normal or healthy harvest yield at or above standard historical levels. "
                "Agro-climatic indicators do not indicate widespread seasonal shortfall or crop failure."
            )
            shortfall_percentage = None
        else:
            yield_classification = "NO"
            yield_classification_label = "NO – LOW CROP YIELD / FAILURE RISK"
            confidence_prob = round(1.0 - prob_yes, 4)
            insurance_indication = "Insurance claim may be possible."
            insurance_indication_detail = (
                "The agricultural model projects harvest yield below the historical crop shortfall threshold (70% of historical median). "
                "If this yield depression is caused by insured perils such as localized flooding, unseasonal rainfall, drought, or pest infestation, "
                "an insurance claim under PMFBY may be eligible for assessment."
            )
            if crop_median > 0:
                shortfall_percentage = max(0.0, round(((crop_median - pred_yield) / crop_median) * 100, 1))
            else:
                shortfall_percentage = 0.0

        # 5. Genuine SHAP Attributions (Question 3: Why did the model give this result?)
        trans = prep.transform(input_df).toarray()
        shap_vals = explainer.shap_values(trans)[0]

        base_val = explainer.expected_value
        if isinstance(base_val, (np.ndarray, list)):
            base_val = float(base_val[0])
        else:
            base_val = float(base_val)
        base_val = round(base_val, 3)

        feature_names = prep.get_feature_names_out()

        grouped = {
            "Crop": {"val": 0.0, "input": crop_clean, "label": "Crop Biological Capacity", "unit": ""},
            "Annual_Rainfall": {"val": 0.0, "input": f"{rainfall_used:.1f} mm", "label": "Annual Monsoon Rainfall", "unit": "mm"},
            "State": {"val": 0.0, "input": state_clean, "label": "State Agro-Climatic Zone", "unit": ""},
            "District": {"val": 0.0, "input": district_clean, "label": "District Soil & Climate", "unit": ""},
            "Season": {"val": 0.0, "input": season_clean, "label": "Seasonal Timing & Cycle", "unit": ""},
            "Area": {"val": 0.0, "input": f"{request.area:.2f} Ha", "label": "Cultivated Land Holding Size", "unit": "Ha"},
            "Fertilizer_per_ha": {"val": 0.0, "input": f"{fert_used:.1f} kg/ha", "label": "Fertilizer Application Rate", "unit": "kg/ha"},
            "Avg_Temp": {"val": 0.0, "input": f"{temp_used:.1f} °C", "label": "Average Surface Temperature", "unit": "°C"},
            "Pesticide_per_ha": {"val": 0.0, "input": f"{pest_used:.2f} kg/ha", "label": "Plant Protection / Pesticide", "unit": "kg/ha"}
        }

        for name, val in zip(feature_names, shap_vals):
            if name.startswith("cat__Crop"):
                grouped["Crop"]["val"] += float(val)
            elif name.startswith("num__Annual_Rainfall"):
                grouped["Annual_Rainfall"]["val"] += float(val)
            elif name.startswith("cat__State"):
                grouped["State"]["val"] += float(val)
            elif name.startswith("cat__District"):
                grouped["District"]["val"] += float(val)
            elif name.startswith("cat__Season"):
                grouped["Season"]["val"] += float(val)
            elif name.startswith("num__Area"):
                grouped["Area"]["val"] += float(val)
            elif name.startswith("num__Fertilizer_per_ha"):
                grouped["Fertilizer_per_ha"]["val"] += float(val)
            elif name.startswith("num__Avg_Temp"):
                grouped["Avg_Temp"]["val"] += float(val)
            elif name.startswith("num__Pesticide_per_ha"):
                grouped["Pesticide_per_ha"]["val"] += float(val)

        contributions = []
        for k, item in grouped.items():
            v = round(item["val"], 4)
            direction = "positive" if v > 0.02 else ("negative" if v < -0.02 else "neutral")
            if direction == "positive":
                impact_desc = f"Supported higher expected yield by +{abs(v):.2f} T/Ha ({item['input']})"
            elif direction == "negative":
                impact_desc = f"Constrained yield by -{abs(v):.2f} T/Ha ({item['input']})"
            else:
                impact_desc = f"Neutral impact near baseline ({item['input']})"

            contributions.append({
                "feature": k,
                "label": item["label"],
                "input_value": item["input"],
                "shap_value": v,
                "direction": direction,
                "impact_description": impact_desc
            })

        contributions_sorted = sorted(contributions, key=lambda x: abs(x["shap_value"]), reverse=True)
        top_pos = [c["label"] for c in contributions_sorted if c["direction"] == "positive"]
        top_neg = [c["label"] for c in contributions_sorted if c["direction"] == "negative"]
        neutral_factors = [c["label"] for c in contributions_sorted if c["direction"] == "neutral"]

        # 6. Compose Dynamic Farmer-Friendly Explanation
        pos_text = f"Key supporting factors include {', '.join(top_pos[:2])}." if top_pos else "No major boosting factors were observed."
        neg_text = f"Primary yield limitations or risk factors include {', '.join(top_neg[:2])}." if top_neg else "No severe environmental constraints were detected."

        if yield_classification == "YES":
            status_text = (
                f"GOOD HARVEST OUTCOME: Your {crop_clean} crop is expected to produce approximately {pred_yield:.2f} Tonnes per Hectare "
                f"(total estimated harvest: {pred_total:.2f} Tonnes on {request.area:.2f} Ha). "
                f"This is above the low-yield risk threshold of {crop_threshold:.2f} Tonnes/Ha. {pos_text} {neg_text} "
                f"Result: Insurance claim is not indicated based on current crop yield projection."
            )
        else:
            status_text = (
                f"HARVEST SHORTFALL ALERT: Your {crop_clean} crop is projected at {pred_yield:.2f} Tonnes per Hectare "
                f"(total estimated harvest: {pred_total:.2f} Tonnes on {request.area:.2f} Ha), "
                f"which is below the historical shortfall threshold of {crop_threshold:.2f} Tonnes/Ha "
                f"({shortfall_percentage:.1f}% below normal historical median of {crop_median:.2f} T/Ha). "
                f"{neg_text} {pos_text} "
                f"Result: Insurance claim may be possible if this shortfall is due to an insured agricultural peril."
            )

        # 7. Check warnings & edge conditions
        warnings = []
        known_states = set(ohe.categories_[0])
        known_districts_upper = set(str(d).upper() for d in ohe.categories_[1])
        known_crops_lower = set(str(c).lower() for c in ohe.categories_[2])

        if state_clean not in known_states:
            warnings.append(f"State '{state_clean}' was not directly observed in historical training records. Nationwide agro-climatic averages applied.")
        if district_clean.upper() not in known_districts_upper and district_clean not in known_districts_upper:
            warnings.append(f"District '{district_clean}' is not in historical district database. State-level aggregate applied.")
        if crop_clean.lower() not in known_crops_lower:
            warnings.append(f"Crop '{crop_clean}' was not directly observed in training data. General agricultural baseline applied.")
        if request.area > 5000:
            warnings.append(f"Cultivated area ({request.area:.1f} Ha) is exceptionally large compared to standard smallholder farm holdings.")

        # AI Crop Insurance Eligibility Prediction (Requirement 1B & 1C)
        if len(warnings) >= 2:
            predicted_eligibility = "Insufficient Information to Predict"
        elif yield_classification == "NO":
            predicted_eligibility = "Likely Eligible for Insurance Claim"
        else:
            predicted_eligibility = "Likely Not Eligible for Insurance Claim"

        reasons_supporting = []
        reasons_against = []
        reasons_neutral = []

        for feat in contributions_sorted:
            if feat["direction"] == "negative":
                # In yield prediction, negative impact on yield indicates shortfall/stress => supports insurance claim
                reasons_supporting.append(f"{feat['label']}: {feat['impact_description']}")
            elif feat["direction"] == "positive":
                # Positive impact on yield indicates healthy growth => indicates claim not needed
                reasons_against.append(f"{feat['label']}: {feat['impact_description']}")
            else:
                reasons_neutral.append(f"{feat['label']}: Normal/baseline condition ({feat['input_value']})")

        yield_quintals_per_acre = round(pred_yield * 4.047, 2)
        total_quintals = round(pred_total * 10.0, 2)

        metrics = bundle.get("metrics", {})

        return AgriculturalYieldPredictResponse(
            predicted_yield_tonnes_per_ha=pred_yield,
            predicted_total_production_tonnes=pred_total,
            cultivated_area_ha=float(request.area),
            unit_yield="Tonnes / Hectare",
            unit_production="Tonnes",
            predicted_yield_quintals_per_acre=yield_quintals_per_acre,
            predicted_total_quintals=total_quintals,
            yield_classification=yield_classification,
            yield_classification_label=yield_classification_label,
            classification_probability=confidence_prob,
            crop_historical_median_yield=crop_median,
            crop_yield_threshold=crop_threshold,
            shortfall_percentage=shortfall_percentage,
            predicted_insurance_eligibility=predicted_eligibility,
            insurance_indication=insurance_indication,
            insurance_indication_detail=insurance_indication_detail,
            reasons_supporting_claim=reasons_supporting,
            reasons_against_claim=reasons_against,
            neutral_factors=reasons_neutral,
            shap_explanation={
                "base_value": base_val,
                "feature_contributions": contributions_sorted,
                "top_positive_features": top_pos,
                "top_negative_features": top_neg,
                "neutral_features": neutral_factors,
                "plain_text_summary": status_text
            },
            farmer_friendly_explanation=status_text,
            environmental_inputs={
                "annual_rainfall_mm": rainfall_used,
                "annual_rainfall_provenance": rainfall_prov,
                "avg_temperature_c": temp_used,
                "avg_temperature_provenance": temp_prov,
                "fertilizer_kg_per_ha": fert_used,
                "fertilizer_provenance": fert_prov,
                "pesticide_kg_per_ha": pest_used,
                "pesticide_provenance": pest_prov,
                "satellite_ndvi_status": "Active in Model 1 insurance assessment; historical IMD and APY baselines applied for yield estimation."
            },
            baseline_mean_yield=base_val,
            difference_from_baseline=round(pred_yield - base_val, 3),
            model_info={
                "model_id": record.id if record else 2,
                "model_name": record.model_name if record else "Agricultural Crop Yield & Insurance Indication Engine (APY-IMD-v2)",
                "model_version": record.model_version if record else bundle.get("model_version", "v2.cdff65"),
                "algorithm": bundle.get("algorithm", "Dual Random Forest (Regressor & Balanced Classifier)"),
                "task_type": "hybrid_yield_prediction",
                "dataset_name": "Harmonized APY District Records + IMD Annual Rainfall + Patelris Surface Temperatures (1997–2020)",
                "r2_score": metrics.get("regression_random_split", {}).get("r2", 0.9136),
                "mae": metrics.get("regression_random_split", {}).get("mae", 1.0752),
                "rmse": metrics.get("regression_random_split", {}).get("rmse", 3.8117),
                "temporal_r2": metrics.get("regression_temporal_split", {}).get("r2", 0.8400),
                "temporal_f1": metrics.get("classification_temporal_split", {}).get("f1_score", 0.8748),
                "training_records": bundle.get("training_records", 310813),
                "is_active": False  # Strictly inactive for claim decisions
            },
            disclaimer=(
                "PROJECT INDICATION DISCLAIMER: This prediction is an agronomic yield estimate based on historical Indian crop production records (1997–2020) "
                "and IMD meteorological records. It provides a helpful preliminary indication of potential crop shortfall. "
                "However, it does NOT guarantee actual harvest yields, nor does it constitute an official insurance claim approval, rejection, or payout decision under PMFBY or any statutory scheme. "
                "Official claims must undergo statutory loss assessment, localized survey verification, and insurance company adjustor review."
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




