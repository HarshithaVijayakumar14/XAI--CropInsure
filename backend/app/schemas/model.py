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
    # Optional weather and agricultural input parameters (auto-retrieved from regional IMD/APY baselines if omitted)
    annual_rainfall: Optional[float] = Field(None, ge=0, le=10000, description="Annual rainfall in mm (auto-retrieved if omitted)")
    avg_temperature: Optional[float] = Field(None, ge=-10, le=60, description="Average surface temperature in °C (auto-retrieved if omitted)")
    fertilizer_per_ha: Optional[float] = Field(None, ge=0, le=5000, description="Fertilizer consumption kg/ha (auto-retrieved if omitted)")
    pesticide_per_ha: Optional[float] = Field(None, ge=0, le=500, description="Pesticide consumption kg/ha (auto-retrieved if omitted)")

class AgriculturalYieldPredictResponse(BaseModel):
    # Core Question 1: How much crop yield is expected?
    predicted_yield_tonnes_per_ha: float
    predicted_total_production_tonnes: float
    cultivated_area_ha: float
    unit_yield: str = "Tonnes / Hectare"
    unit_production: str = "Tonnes"
    predicted_yield_quintals_per_acre: float = 0.0
    predicted_total_quintals: float = 0.0
    
    # Core Question 2: Will the crop yield come or not?
    yield_classification: str = Field(..., description="'YES' (Normal/Expected Harvest) or 'NO' (Low Yield / Failure Risk)")
    yield_classification_label: str = Field(..., description="Human-readable label for farmers")
    classification_probability: float = Field(..., description="Probability of expected yield (0.0 to 1.0)")
    crop_historical_median_yield: float
    crop_yield_threshold: float
    shortfall_percentage: Optional[float] = None
    
    # AI Crop Insurance Eligibility Prediction (Requirement 1B)
    predicted_insurance_eligibility: str = Field(
        ...,
        description="'Likely Eligible for Insurance Claim' | 'Likely Not Eligible for Insurance Claim' | 'Insufficient Information to Predict'"
    )
    insurance_indication: str = Field(..., description="Summary indication")
    insurance_indication_detail: str
    reasons_supporting_claim: List[str] = Field(default_factory=list)
    reasons_against_claim: List[str] = Field(default_factory=list)
    neutral_factors: List[str] = Field(default_factory=list)
    
    # Core Question 3: Why did the model give this result?
    shap_explanation: Dict[str, Any]
    farmer_friendly_explanation: str
    
    # Context & Inputs used (with data provenance)
    environmental_inputs: Dict[str, Any] = Field(default_factory=dict)
    
    # Backward compatibility
    baseline_mean_yield: float
    difference_from_baseline: float
    
    model_info: Dict[str, Any]
    disclaimer: str
    warnings: List[str] = Field(default_factory=list)

