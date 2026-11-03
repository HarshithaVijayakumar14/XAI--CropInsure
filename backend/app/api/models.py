import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd

from backend.app.database.session import get_db
from backend.app.database.models import TrainedModel, ImportedDataset
from backend.app.schemas.model import ModelTrainRequest, TrainedModelResponse, SetActiveModelRequest
from backend.app.ml.trainer import ModelTrainingPipeline
from backend.app.ml.shap_explainer import ShapExplanationService
from backend.app.ml.feature_engineering import compute_agricultural_features
from backend.app.services.audit_service import log_audit_event
from backend.app.schemas.assessment import GlobalExplanationResponse

router = APIRouter()

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


