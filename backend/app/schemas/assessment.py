from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class AssessmentRequest(BaseModel):
    model_id: Optional[int] = None  # If None, use currently active model

class ShapFeatureContribution(BaseModel):
    feature: str
    feature_name_display: str
    observed_value: Any
    shap_value: float
    direction: str  # "positive", "negative", "neutral"
    interpretation: str

class StatutoryCheckItem(BaseModel):
    check_id: str
    title: str
    status: str  # "Passed", "Failed", "Needs Verification", "Not Applicable"
    details: str
    evidence_used: str
    rule_reference: str

class MissingEvidenceItem(BaseModel):
    document_or_evidence: str
    required_for: str
    status: str  # "Verified", "Pending / Missing", "Needs Physical Inspection"
    guidance: str

class PMFBYRuleAssessmentResult(BaseModel):
    loss_category: str
    loss_category_description: str
    reported_peril: str
    is_peril_consistent: Optional[bool] = None
    peril_consistency_notes: str
    preliminary_triage: str  # "Fast-Track Eligible", "Field Survey Required", "Statutory Review Flagged", "Needs Verification"
    triage_summary: str
    checks: List[StatutoryCheckItem] = []
    evidence_checklist: List[MissingEvidenceItem] = []
    applicable_deadline_hours: Optional[float] = None
    elapsed_hours_to_notification: Optional[float] = None
    notified_coverage_benchmark: Optional[Dict[str, Any]] = None
    disclaimer: str
    assessed_at: str

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
    statutory_rules: Optional[PMFBYRuleAssessmentResult] = None
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

