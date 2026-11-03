import os
import json
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from backend.app.database.models import ImportedDataset
from backend.app.config import settings
from backend.app.services.audit_service import log_audit_event

STANDARD_TEMPLATE_COLUMNS = [
    "claim_reference",
    "farmer_name",
    "policy_reference",
    "crop_type",
    "state",
    "district",
    "season",
    "sowing_date",
    "claim_start_date",
    "claim_end_date",
    "cultivated_area",
    "observed_rainfall",
    "reference_rainfall",
    "soil_moisture",
    "observed_temperature",
    "reference_temperature",
    "current_ndvi",
    "reference_ndvi",
    "historical_outcome",
    "payout_amount"
]

def generate_csv_template() -> str:
    """Creates a downloadable template CSV file with instructions and sample rows."""
    template_path = os.path.join(settings.DATA_DIR, "templates", "crop_insurance_data_template.csv")
    os.makedirs(os.path.dirname(template_path), exist_ok=True)
    
    sample_rows = [
        {
            "claim_reference": "REF-EXAMPLE-001",
            "farmer_name": "Ramesh Patel",
            "policy_reference": "POL-PMFBY-2025-01",
            "crop_type": "Rice/Paddy",
            "state": "Maharashtra",
            "district": "Solapur",
            "season": "Kharif",
            "sowing_date": "2025-06-25",
            "claim_start_date": "2025-07-01",
            "claim_end_date": "2025-11-01",
            "cultivated_area": 2.5,
            "observed_rainfall": 280.0,
            "reference_rainfall": 820.0,
            "soil_moisture": 18.5,
            "observed_temperature": 34.2,
            "reference_temperature": 30.5,
            "current_ndvi": 0.32,
            "reference_ndvi": 0.68,
            "historical_outcome": "Approved",
            "payout_amount": 35000.0
        },
        {
            "claim_reference": "REF-EXAMPLE-002",
            "farmer_name": "Suresh Kumar",
            "policy_reference": "POL-PMFBY-2025-02",
            "crop_type": "Wheat",
            "state": "Madhya Pradesh",
            "district": "Ujjain",
            "season": "Rabi",
            "sowing_date": "2025-11-15",
            "claim_start_date": "2025-11-20",
            "claim_end_date": "2026-03-20",
            "cultivated_area": 3.0,
            "observed_rainfall": 110.0,
            "reference_rainfall": 105.0,
            "soil_moisture": 55.0,
            "observed_temperature": 21.0,
            "reference_temperature": 20.8,
            "current_ndvi": 0.65,
            "reference_ndvi": 0.64,
            "historical_outcome": "Rejected",
            "payout_amount": 0.0
        }
    ]
    df = pd.DataFrame(sample_rows)
    df.to_csv(template_path, index=False)
    return template_path

def inspect_and_validate_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Performs comprehensive data quality checks on uploaded dataframe:
    - Missing value count & percentage
    - Duplicate detection
    - Data type identification
    - Value ranges (NDVI, rainfall, temperature)
    """
    row_count = len(df)
    col_count = len(df.columns)
    
    missing_dict = {}
    for col in df.columns:
        null_count = int(df[col].isna().sum())
        missing_dict[col] = {
            "null_count": null_count,
            "null_percentage": round((null_count / max(1, row_count)) * 100, 2),
            "dtype": str(df[col].dtype)
        }

    duplicate_rows = int(df.duplicated().sum())

    range_checks = {}
    if "current_ndvi" in df.columns:
        out_of_bounds = int(((df["current_ndvi"] < -1.0) | (df["current_ndvi"] > 1.0)).sum())
        range_checks["ndvi_out_of_bounds"] = out_of_bounds

    if "observed_rainfall" in df.columns:
        negative_rain = int((df["observed_rainfall"] < 0).sum())
        range_checks["negative_rainfall"] = negative_rain

    quality_summary = {
        "total_rows": row_count,
        "total_columns": col_count,
        "duplicate_rows": duplicate_rows,
        "range_checks": range_checks,
        "has_target_column": "historical_outcome" in df.columns or "payout_amount" in df.columns,
        "detected_targets": [c for c in ["historical_outcome", "payout_amount"] if c in df.columns]
    }

    return {
        "columns": list(df.columns),
        "missing_summary": missing_dict,
        "quality_summary": quality_summary
    }

def register_imported_dataset(
    db: Session,
    name: str,
    file_path: str,
    category: str = "Historical Claims",
    source: str = "CSV Upload",
    is_synthetic: bool = False,
    actor: str = "Assessor"
) -> ImportedDataset:
    df = pd.read_csv(file_path)
    analysis = inspect_and_validate_dataset(df)

    ds = ImportedDataset(
        name=name,
        source=source,
        category=category,
        file_path=file_path,
        row_count=len(df),
        column_count=len(df.columns),
        columns_json=json.dumps(analysis["columns"]),
        missing_summary=json.dumps(analysis["missing_summary"]),
        quality_summary=json.dumps(analysis["quality_summary"]),
        is_synthetic=is_synthetic,
        import_status="Ready"
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)

    log_audit_event(
        db,
        event_type="DATASET_IMPORTED",
        actor=actor,
        details=f"Dataset '{name}' ({len(df)} rows, {len(df.columns)} columns) imported. Synthetic: {is_synthetic}."
    )
    return ds

