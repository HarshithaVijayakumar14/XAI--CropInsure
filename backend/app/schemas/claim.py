from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class ClaimBase(BaseModel):
    farmer_name: str = Field(..., min_length=2, max_length=100)
    contact_number: Optional[str] = None
    policy_reference: str = Field(..., min_length=2, max_length=50)
    insurance_scheme: str = "Pradhan Mantri Fasal Bima Yojana (PMFBY)"
    sum_insured: Optional[float] = Field(None, ge=0)
    
    state: str
    district: str
    village: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    crop_type: str
    season: str
    sowing_date: str
    claim_start_date: str
    claim_end_date: str
    loss_date: Optional[str] = None
    reported_loss_pct: Optional[float] = Field(None, ge=0, le=100)
    loss_description: Optional[str] = None

    growth_stage: Optional[str] = None
    cultivated_area: float = Field(..., gt=0)
    expected_yield: Optional[float] = Field(None, ge=0)
    observed_yield: Optional[float] = Field(None, ge=0)
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None

    observed_rainfall: float = Field(..., ge=0)
    reference_rainfall: float = Field(..., ge=0)
    soil_moisture: Optional[float] = Field(None, ge=0, le=100)
    observed_temperature: float = Field(..., ge=-20, le=60)
    reference_temperature: float = Field(..., ge=-20, le=60)
    current_ndvi: float = Field(..., ge=-1.0, le=1.0)
    reference_ndvi: float = Field(..., ge=-1.0, le=1.0)

    historical_outcome: Optional[str] = None

class ClaimCreate(ClaimBase):
    claim_reference: Optional[str] = None
    is_demo_record: bool = False

class ClaimUpdate(BaseModel):
    farmer_name: Optional[str] = None
    contact_number: Optional[str] = None
    policy_reference: Optional[str] = None
    insurance_scheme: Optional[str] = None
    sum_insured: Optional[float] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    crop_type: Optional[str] = None
    season: Optional[str] = None
    sowing_date: Optional[str] = None
    claim_start_date: Optional[str] = None
    claim_end_date: Optional[str] = None
    loss_date: Optional[str] = None
    reported_loss_pct: Optional[float] = None
    loss_description: Optional[str] = None
    growth_stage: Optional[str] = None
    cultivated_area: Optional[float] = None
    expected_yield: Optional[float] = None
    observed_yield: Optional[float] = None
    soil_type: Optional[str] = None
    irrigation_type: Optional[str] = None
    observed_rainfall: Optional[float] = None
    reference_rainfall: Optional[float] = None
    soil_moisture: Optional[float] = None
    observed_temperature: Optional[float] = None
    reference_temperature: Optional[float] = None
    current_ndvi: Optional[float] = None
    reference_ndvi: Optional[float] = None
    status: Optional[str] = None

class ClaimResponse(ClaimBase):
    id: int
    claim_reference: str
    status: str
    data_quality_flags: str
    is_demo_record: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
