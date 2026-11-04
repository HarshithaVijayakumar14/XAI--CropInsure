from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.services.external_data_service import (
    fetch_weather_observations,
    check_satellite_ndvi,
    search_pmfby_reference
)

router = APIRouter(prefix="/external", tags=["External Agricultural Data"])

class WeatherRequest(BaseModel):
    state: str = Field(..., description="Indian State")
    district: str = Field(..., description="District Name")
    start_date: str = Field(..., description="Sowing or start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="Incident or end date (YYYY-MM-DD)")
    latitude: Optional[float] = Field(None, description="Optional GPS Latitude")
    longitude: Optional[float] = Field(None, description="Optional GPS Longitude")

class SatelliteNdviRequest(BaseModel):
    state: str = Field(..., description="Indian State")
    district: str = Field(..., description="District Name")
    observation_date: str = Field(..., description="Target date of observation (YYYY-MM-DD)")
    latitude: Optional[float] = Field(None, description="Optional GPS Latitude")
    longitude: Optional[float] = Field(None, description="Optional GPS Longitude")

class PmfbyReferenceRequest(BaseModel):
    state: str = Field(..., description="Indian State")
    district: str = Field(..., description="District Name")
    crop: str = Field(..., description="Crop Type")
    season: str = Field(..., description="Season (Kharif, Rabi, Zaid)")
    year: Optional[int] = Field(None, description="Crop Year")

@router.post("/weather")
def get_weather(request: WeatherRequest):
    """
    Attempts automatic weather observation retrieval from ECMWF/Open-Meteo.
    Returns rainfall, temperature, source, period, and full provenance.
    Never fabricates values.
    """
    res = fetch_weather_observations(
        state=request.state,
        district=request.district,
        start_date=request.start_date,
        end_date=request.end_date,
        latitude=request.latitude,
        longitude=request.longitude
    )
    return res

@router.post("/satellite-ndvi")
def get_satellite_ndvi(request: SatelliteNdviRequest):
    """
    Checks satellite NDVI availability.
    Returns status, observation date, and source.
    If unavailable, reports unavailable truthfully without inventing estimates.
    """
    res = check_satellite_ndvi(
        state=request.state,
        district=request.district,
        observation_date=request.observation_date,
        latitude=request.latitude,
        longitude=request.longitude
    )
    return res

@router.post("/pmfby-reference")
def get_pmfby_reference(request: PmfbyReferenceRequest):
    """
    Searches the official PMFBY notified coverage reference database for statutory benchmarks.
    Displays source, period, sum insured, and disclaimer.
    """
    res = search_pmfby_reference(
        state=request.state,
        district=request.district,
        crop=request.crop,
        season=request.season,
        year=request.year
    )
    return res

