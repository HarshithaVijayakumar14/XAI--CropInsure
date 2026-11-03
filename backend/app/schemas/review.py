from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ReviewCreateRequest(BaseModel):
    reviewer_name: str = Field(..., min_length=2, max_length=100)
    reviewer_role: str = "Claim Assessor"
    review_decision: str = Field(..., description="Approved, Rejected, Additional Evidence Required, Escalated")
    differs_from_model: bool = False
    rationale: str = Field(..., min_length=5)
    required_evidence: Optional[str] = None
    update_workflow_status: Optional[str] = "Human review completed"

class ReviewResponse(BaseModel):
    id: int
    claim_id: int
    reviewer_name: str
    reviewer_role: str
    review_decision: str
    differs_from_model: bool
    rationale: str
    required_evidence: Optional[str] = None
    reviewed_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuditEventResponse(BaseModel):
    id: int
    claim_id: Optional[int] = None
    event_type: str
    actor: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    details: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
