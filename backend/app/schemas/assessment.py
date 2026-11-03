from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AssessmentRequest(BaseModel):
    model_id: Optional[int] = None  # If None, use currently active model

class ShapFeatureContribution(BaseModel):
    feature: str
    feature_name_display: str
    observed_value: Any
    shap_value: float
    direction: str  # "positive", "negative", "neutral"
    interpretation: str

class AssessmentResponse(BaseModel):
    id: int
    claim_id: int
    claim_reference: str
    model_id: int
    model_name: str
    model_version: str
    prediction_label: Optional[str] = None
    prediction_probability: Optional[float] = None
    payout_estimate: Optional[float] = None
    base_value: Optional[float] = None
    shap_contributions: List[ShapFeatureContribution] = []
    farmer_friendly_summary: str
    missing_evidence_notes: Optional[str] = None
    data_quality_status: str
    data_quality_warnings: List[str] = []
    assessed_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GlobalExplanationResponse(BaseModel):
    model_id: int
    model_name: str
    model_version: str
    feature_importance: List[Dict[str, Any]]
    dataset_name: Optional[str] = None
    evaluation_sample_size: int
    summary_description: str
