import os
import numpy as np
import pandas as pd
from typing import Optional
from backend.app.config import settings

CROPS = ["Rice/Paddy", "Wheat", "Cotton", "Maize", "Groundnut", "Mustard", "Soybean", "Sugarcane"]
STATES = [
    "Maharashtra", "Madhya Pradesh", "Uttar Pradesh", "Rajasthan",
    "Punjab", "Karnataka", "Andhra Pradesh", "Gujarat", "Haryana", "Tamil Nadu"
]
DISTRICTS = {
    "Maharashtra": ["Solapur", "Ahmednagar", "Nashik", "Latur", "Amravati"],
    "Madhya Pradesh": ["Ujjain", "Dewas", "Sehore", "Vidisha", "Hoshangabad"],
    "Uttar Pradesh": ["Varanasi", "Jhansi", "Gorakhpur", "Aligarh", "Mathura"],
    "Rajasthan": ["Barmer", "Nagaur", "Kota", "Jodhpur", "Bikaner"],
    "Punjab": ["Ludhiana", "Patiala", "Bathinda", "Sangrur", "Amritsar"],
    "Karnataka": ["Dharwad", "Belagavi", "Tumakuru", "Kalaburagi", "Ballari"],
    "Andhra Pradesh": ["Anantapur", "Kurnool", "Guntur", "Krishna", "Chittoor"],
    "Gujarat": ["Rajkot", "Junagadh", "Amreli", "Surendranagar", "Bhavnagar"],
    "Haryana": ["Karnal", "Hisar", "Rohtak", "Sirsa", "Fatehabad"],
    "Tamil Nadu": ["Thanjavur", "Tiruvarur", "Madurai", "Salem", "Coimbatore"]
}
SOIL_TYPES = ["Black Cotton", "Alluvial", "Red Sandy Loam", "Clay Loam", "Sandy Soil"]
IRRIGATION_TYPES = ["Rainfed", "Canal", "Borewell / Tube well", "Drip Irrigation", "Sprinkler"]
STAGES = ["Germination", "Vegetative Growth", "Flowering / Tasseling", "Grain Filling / Pod Formation", "Maturity"]

def generate_synthetic_agricultural_data(
    num_samples: int = 500,
    random_seed: int = 42,
    save_path: Optional[str] = None
) -> pd.DataFrame:
    """
    Generates realistic, reproducible synthetic agricultural crop insurance records for demonstration and testing.
    
    CRITICAL ETHICAL NOTICE:
    ALL RECORDS ARE SYNTHETIC DEMONSTRATION DATA — NOT REAL FARMER OR INSURANCE RECORDS.
    """
    np.random.seed(random_seed)

    records = []
    for i in range(1, num_samples + 1):
        claim_ref = f"SYN-2026-{i:05d}"
        state = np.random.choice(STATES)
        district = np.random.choice(DISTRICTS[state])
        crop = np.random.choice(CROPS)
        soil = np.random.choice(SOIL_TYPES)
        irrigation = np.random.choice(IRRIGATION_TYPES, p=[0.45, 0.25, 0.2, 0.05, 0.05])
        area = round(float(np.random.gamma(shape=2.5, scale=0.8)), 2) # 0.5 to 6 hectares
        area = max(0.5, min(area, 10.0))
        
        # Season based on crop
        if crop in ["Wheat", "Mustard"]:
            season = "Rabi"
            sowing_date = "2025-11-10"
            claim_start = "2025-11-15"
            claim_end = "2026-03-25"
            ref_rainfall = round(float(np.random.uniform(70, 150)), 1)
            ref_temp = round(float(np.random.uniform(18, 25)), 1)
        else:
            season = "Kharif"
            sowing_date = "2025-06-20"
            claim_start = "2025-07-01"
            claim_end = "2025-11-05"
            ref_rainfall = round(float(np.random.uniform(650, 1100)), 1)
            ref_temp = round(float(np.random.uniform(28, 33)), 1)

        ref_ndvi = round(float(np.random.uniform(0.60, 0.78)), 3)
        growth_stage = np.random.choice(STAGES)
        
        # Simulate Climate Shock Scenarios:
        # 0: Severe Drought (high deficit, high drop in NDVI, low soil moisture)
        # 1: Moderate Deficit / Stress
        # 2: Normal / Good Season (healthy crop)
        # 3: Unseasonal Heatwave / Flood
        scenario = np.random.choice([0, 1, 2, 3], p=[0.35, 0.25, 0.30, 0.10])

        if scenario == 0:  # Severe Drought
            obs_rainfall = round(float(ref_rainfall * np.random.uniform(0.20, 0.45)), 1)
            obs_temp = round(float(ref_temp + np.random.uniform(2.5, 5.0)), 1)
            current_ndvi = round(float(ref_ndvi - np.random.uniform(0.20, 0.38)), 3)
            current_ndvi = max(0.15, current_ndvi)
            soil_moisture = round(float(np.random.uniform(12, 28)), 1)
            reported_loss = round(float(np.random.uniform(55, 90)), 1)
            historical_outcome = "Approved"
            payout = round(float(area * np.random.uniform(25000, 45000)), 2)
            loss_desc = "Severe monsoon failure causing vegetative withering and terminal drought stress."
        elif scenario == 1:  # Moderate Deficit
            obs_rainfall = round(float(ref_rainfall * np.random.uniform(0.55, 0.75)), 1)
            obs_temp = round(float(ref_temp + np.random.uniform(0.5, 2.0)), 1)
            current_ndvi = round(float(ref_ndvi - np.random.uniform(0.08, 0.18)), 3)
            soil_moisture = round(float(np.random.uniform(30, 45)), 1)
            reported_loss = round(float(np.random.uniform(30, 50)), 1)
            # Moderates are split based on irrigation
            if irrigation in ["Drip Irrigation", "Sprinkler", "Canal"]:
                historical_outcome = "Rejected"
                payout = 0.0
                loss_desc = "Partial dry spell mitigated by available irrigation infrastructure."
            else:
                historical_outcome = "Approved"
                payout = round(float(area * np.random.uniform(12000, 22000)), 2)
                loss_desc = "Prolonged dry spell during critical flowering stage for rainfed plot."
        elif scenario == 2:  # Normal Season
            obs_rainfall = round(float(ref_rainfall * np.random.uniform(0.85, 1.20)), 1)
            obs_temp = round(float(ref_temp + np.random.uniform(-1.0, 1.0)), 1)
            current_ndvi = round(float(ref_ndvi + np.random.uniform(-0.04, 0.06)), 3)
            current_ndvi = min(0.85, current_ndvi)
            soil_moisture = round(float(np.random.uniform(50, 75)), 1)
            reported_loss = round(float(np.random.uniform(5, 20)), 1)
            historical_outcome = "Rejected"
            payout = 0.0
            loss_desc = "Normal seasonal conditions observed; minimal yield loss verified by remote sensing."
        else:  # Excessive Rainfall / Waterlogging
            obs_rainfall = round(float(ref_rainfall * np.random.uniform(1.40, 2.10)), 1)
            obs_temp = round(float(ref_temp - np.random.uniform(1.0, 3.0)), 1)
            current_ndvi = round(float(ref_ndvi - np.random.uniform(0.15, 0.30)), 3)
            soil_moisture = round(float(np.random.uniform(80, 98)), 1)
            reported_loss = round(float(np.random.uniform(45, 80)), 1)
            historical_outcome = "Approved"
            payout = round(float(area * np.random.uniform(20000, 38000)), 2)
            loss_desc = "Excessive torrential downpour causing root lodging and prolonged field inundation."

        records.append({
            "claim_reference": claim_ref,
            "farmer_name": f"Demo Farmer {i}",
            "policy_reference": f"POL-PMFBY-{2025 + (i%2)}-{i:04d}",
            "insurance_scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "state": state,
            "district": district,
            "village": f"Village {i % 50 + 1}",
            "crop_type": crop,
            "season": season,
            "sowing_date": sowing_date,
            "claim_start_date": claim_start,
            "claim_end_date": claim_end,
            "reported_loss_pct": reported_loss,
            "loss_description": loss_desc,
            "growth_stage": growth_stage,
            "cultivated_area": area,
            "soil_type": soil,
            "irrigation_type": irrigation,
            "observed_rainfall": obs_rainfall,
            "reference_rainfall": ref_rainfall,
            "soil_moisture": soil_moisture,
            "observed_temperature": obs_temp,
            "reference_temperature": ref_temp,
            "current_ndvi": current_ndvi,
            "reference_ndvi": ref_ndvi,
            "historical_outcome": historical_outcome,
            "payout_amount": payout,
            "data_provenance": "SYNTHETIC DEMONSTRATION DATA — NOT REAL FARMER OR INSURANCE RECORDS."
        })

    df = pd.DataFrame(records)

    target_path = save_path or os.path.join(settings.DATA_DIR, "demo", "synthetic_crop_claims_demo.csv")
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    df.to_csv(target_path, index=False)
    return df

