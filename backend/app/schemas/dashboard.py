from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class DashboardSummaryResponse(BaseModel):
    total_claims: int
    claims_awaiting_review: int
    claims_model_assessed: int
    claims_requiring_evidence: int
    claims_human_reviewed: int
    is_demo_data: bool
    demo_banner_message: str

class ChartDataPoint(BaseModel):
    name: str
    value: float
    secondary_value: Optional[float] = None
    category: Optional[str] = None

class DashboardChartsResponse(BaseModel):
    status_distribution: List[ChartDataPoint]
    claims_over_time: List[ChartDataPoint]
    prediction_distribution: List[ChartDataPoint]
    crop_distribution: List[ChartDataPoint]
    region_distribution: List[ChartDataPoint]
    top_model_features: List[ChartDataPoint]
    data_quality_summary: Dict[str, Any]
    recent_activity: List[Dict[str, Any]]

