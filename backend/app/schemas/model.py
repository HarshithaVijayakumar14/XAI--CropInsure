from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ModelTrainRequest(BaseModel):
    dataset_id: int
    task_type: str = "classification"  # 'classification' or 'regression'
    algorithm: str = "Random Forest"   # 'Random Forest', 'Gradient Boosting', 'Logistic Regression', 'Decision Tree', 'Linear Regression'
    target_column: str = "historical_outcome"
    features: List[str] = Field(default=[
        "rainfall_deficit",
        "relative_rainfall_deficit",
        "ndvi_change",
        "temperature_anomaly",
        "soil_moisture",
        "cultivated_area",
        "crop_type",
        "season"
    ])
    test_size: float = 0.2
    random_state: int = 42
    model_name: Optional[str] = None

class TrainedModelResponse(BaseModel):
    id: int
    model_name: str
    model_version: str
    task_type: str
    algorithm: str
    target_column: str
    features_used: str
    metrics_json: str
    is_synthetic_trained: bool
    is_active: bool
    dataset_name: Optional[str] = None
    training_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SetActiveModelRequest(BaseModel):
    model_id: int

class AgriculturalYieldPredictRequest(BaseModel):
    state: str = Field(..., description="State name (e.g. Karnataka)")
    district: str = Field(..., description="District name (e.g. Dharwad)")
    crop: str = Field(..., description="Crop name (e.g. Rice)")
    season: str = Field(default="Kharif", description="Crop season (e.g. Kharif, Rabi, Whole Year)")
    area: float = Field(..., gt=0, le=100000, description="Cultivated area in hectares")

class AgriculturalYieldPredictResponse(BaseModel):
    predicted_yield_tonnes_per_ha: float
    predicted_total_production_tonnes: float
    cultivated_area_ha: float
    unit_yield: str = "Tonnes / Hectare"
    unit_production: str = "Tonnes"
    baseline_mean_yield: float
    difference_from_baseline: float
    shap_explanation: Dict[str, Any]
    model_info: Dict[str, Any]
    disclaimer: str
    warnings: List[str] = Field(default_factory=list)

