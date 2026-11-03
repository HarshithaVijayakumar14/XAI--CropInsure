import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple

def compute_agricultural_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Computes standard agricultural and environmental features for crop-insurance evaluation:
    1. rainfall_deficit = reference_rainfall - observed_rainfall
    2. relative_rainfall_deficit = (reference_rainfall - observed_rainfall) / reference_rainfall (safe)
    3. ndvi_change = current_ndvi - reference_ndvi
    4. temperature_anomaly = observed_temperature - reference_temperature
    5. drought_stress_index = combination of relative rainfall deficit and negative ndvi change
    """
    data = df.copy()
    warnings = []

    # 1. Rainfall Deficit
    if 'reference_rainfall' in data.columns and 'observed_rainfall' in data.columns:
        data['rainfall_deficit'] = data['reference_rainfall'] - data['observed_rainfall']
        
        # 2. Relative Rainfall Deficit
        def calc_rel_deficit(row):
            ref = row['reference_rainfall']
            obs = row['observed_rainfall']
            if pd.isna(ref) or pd.isna(obs):
                return np.nan
            if ref > 0:
                return (ref - obs) / ref
            return 0.0
            
        data['relative_rainfall_deficit'] = data.apply(calc_rel_deficit, axis=1)
    else:
        warnings.append("Missing rainfall columns (observed_rainfall or reference_rainfall)")
        data['rainfall_deficit'] = 0.0
        data['relative_rainfall_deficit'] = 0.0

    # 3. NDVI Change
    if 'current_ndvi' in data.columns and 'reference_ndvi' in data.columns:
        data['ndvi_change'] = data['current_ndvi'] - data['reference_ndvi']
    else:
        warnings.append("Missing NDVI columns (current_ndvi or reference_ndvi)")
        data['ndvi_change'] = 0.0

    # 4. Temperature Anomaly
    if 'observed_temperature' in data.columns and 'reference_temperature' in data.columns:
        data['temperature_anomaly'] = data['observed_temperature'] - data['reference_temperature']
    else:
        warnings.append("Missing temperature columns (observed_temperature or reference_temperature)")
        data['temperature_anomaly'] = 0.0

    # 5. Compound Drought Stress Index (normalized indicator)
    # Higher value indicates compound moisture and vegetative stress
    rel_def_clipped = data['relative_rainfall_deficit'].clip(lower=0.0, upper=1.0).fillna(0.0)
    ndvi_drop = (-data['ndvi_change']).clip(lower=0.0, upper=1.0).fillna(0.0)
    data['compound_stress_indicator'] = 0.6 * rel_def_clipped + 0.4 * ndvi_drop

    return data, warnings


def validate_claim_data_quality(claim_dict: Dict[str, Any]) -> List[str]:
    """
    Validates data quality for an individual claim and returns list of warning messages.
    Does not invent data; strictly flags suspicious or missing inputs.
    """
    flags = []
    
    # Range validations
    current_ndvi = claim_dict.get('current_ndvi')
    if current_ndvi is not None:
        if current_ndvi < -1.0 or current_ndvi > 1.0:
            flags.append(f"Current NDVI ({current_ndvi}) is out of physical range [-1.0, 1.0].")
        elif current_ndvi < 0:
            flags.append(f"Current NDVI ({current_ndvi}) indicates water body, cloud, or snow rather than vegetation.")

    ref_ndvi = claim_dict.get('reference_ndvi')
    if ref_ndvi is not None and (ref_ndvi < -1.0 or ref_ndvi > 1.0):
        flags.append(f"Reference NDVI ({ref_ndvi}) is out of physical range [-1.0, 1.0].")

    obs_rain = claim_dict.get('observed_rainfall')
    if obs_rain is not None and obs_rain < 0:
        flags.append(f"Observed rainfall ({obs_rain} mm) cannot be negative.")

    ref_rain = claim_dict.get('reference_rainfall')
    if ref_rain is not None and ref_rain < 0:
        flags.append(f"Reference rainfall ({ref_rain} mm) cannot be negative.")

    obs_temp = claim_dict.get('observed_temperature')
    if obs_temp is not None and (obs_temp < -15 or obs_temp > 55):
        flags.append(f"Observed temperature ({obs_temp} °C) is outside typical agricultural range in India.")

    soil_m = claim_dict.get('soil_moisture')
    if soil_m is None:
        flags.append("Soil moisture measurement was unavailable; assessment will rely primarily on rainfall and NDVI.")
    elif soil_m < 0 or soil_m > 100:
        flags.append(f"Soil moisture ({soil_m}%) is outside valid percentage bounds [0, 100].")

    area = claim_dict.get('cultivated_area')
    if area is not None and area <= 0:
        flags.append(f"Cultivated area ({area}) must be strictly positive.")

    loss_pct = claim_dict.get('reported_loss_pct')
    if loss_pct is not None and (loss_pct < 0 or loss_pct > 100):
        flags.append(f"Reported crop loss percentage ({loss_pct}%) must be between 0 and 100.")

    # Temporal logic
    sowing = claim_dict.get('sowing_date')
    claim_start = claim_dict.get('claim_start_date')
    claim_end = claim_dict.get('claim_end_date')
    if sowing and claim_start and sowing > claim_start:
        flags.append(f"Claim period start date ({claim_start}) precedes sowing date ({sowing}).")
    if claim_start and claim_end and claim_start > claim_end:
        flags.append(f"Claim end date ({claim_end}) precedes claim start date ({claim_start}).")

    return flags

