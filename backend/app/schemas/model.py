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
