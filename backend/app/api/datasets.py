import os
import json
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np

from backend.app.database.session import get_db
from backend.app.database.models import ImportedDataset, Claim
from backend.app.schemas.dataset import DatasetResponse, DatasetUploadResponse
from backend.app.services.dataset_service import (
    inspect_and_validate_dataset, register_imported_dataset, generate_csv_template, STANDARD_TEMPLATE_COLUMNS
)
from backend.app.ml.synthetic_generator import generate_synthetic_agricultural_data
from backend.app.config import settings
from backend.app.services.claim_service import create_claim
from backend.app.schemas.claim import ClaimCreate

router = APIRouter()

@router.get("/datasets", response_model=List[DatasetResponse])
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(ImportedDataset).order_by(ImportedDataset.created_at.desc()).all()
    return datasets

@router.post("/datasets/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    category: Optional[str] = Form("Historical Claims"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    unique_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    upload_dir = os.path.join(settings.DATA_DIR, "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_filename)

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25 MB limit
        raise HTTPException(status_code=400, detail="File size exceeds 25MB limit.")

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        df = pd.read_csv(file_path)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    name = dataset_name or file.filename.replace(".csv", "")
    ds = register_imported_dataset(
        db=db,
        name=name,
        file_path=file_path,
        category=category or "Historical Claims",
        source="File Upload",
        is_synthetic=False
    )

    validation = inspect_and_validate_dataset(df)
    preview = df.head(10).replace({np.nan: None}).to_dict(orient="records")

    return DatasetUploadResponse(
        id=ds.id,
        name=ds.name,
        row_count=ds.row_count,
        column_count=ds.column_count,
        columns=validation["columns"],
        missing_summary=validation["missing_summary"],
        quality_summary=validation["quality_summary"],
        preview=preview,
        is_synthetic=False
    )

@router.get("/datasets/{dataset_id}")
def get_dataset_details(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(ImportedDataset).filter(ImportedDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    preview = []
    if os.path.exists(ds.file_path):
        try:
            df = pd.read_csv(ds.file_path)
            preview = df.head(15).replace({np.nan: None}).to_dict(orient="records")
        except Exception:
            preview = []

    return {
        "id": ds.id,
        "name": ds.name,
        "source": ds.source,
        "category": ds.category,
        "row_count": ds.row_count,
        "column_count": ds.column_count,
        "columns": json.loads(ds.columns_json or "[]"),
        "missing_summary": json.loads(ds.missing_summary or "{}"),
        "quality_summary": json.loads(ds.quality_summary or "{}"),
        "is_synthetic": ds.is_synthetic,
        "import_status": ds.import_status,
        "created_at": ds.created_at,
        "preview": preview
    }

@router.get("/datasets/{dataset_id}/validation")
def get_dataset_validation(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(ImportedDataset).filter(ImportedDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {
        "dataset_id": ds.id,
        "name": ds.name,
        "row_count": ds.row_count,
        "column_count": ds.column_count,
        "missing_summary": json.loads(ds.missing_summary or "{}"),
        "quality_summary": json.loads(ds.quality_summary or "{}")
    }

@router.get("/datasets/{dataset_id}/preview")
def get_dataset_preview(dataset_id: int, limit: int = 15, db: Session = Depends(get_db)):
    ds = db.query(ImportedDataset).filter(ImportedDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not os.path.exists(ds.file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    try:
        df = pd.read_csv(ds.file_path)
        preview_data = df.head(limit).replace({np.nan: None}).to_dict(orient="records")
        columns = list(df.columns)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset preview: {str(e)}")

    return {
        "dataset_id": ds.id,
        "name": ds.name,
        "columns": columns,
        "total_rows": len(df),
        "total_columns": len(columns),
        "preview_count": len(preview_data),
        "rows": preview_data
    }

@router.post("/datasets/{dataset_id}/import")
def import_dataset_into_claims(dataset_id: int, max_records: int = 50, db: Session = Depends(get_db)):
    ds = db.query(ImportedDataset).filter(ImportedDataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not os.path.exists(ds.file_path):
        raise HTTPException(status_code=404, detail="Dataset file missing on disk")

    try:
        df = pd.read_csv(ds.file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset file: {str(e)}")

    imported_count = 0
    errors = []
    subset = df.head(max_records)

    for idx, row in subset.iterrows():
        try:
            claim_ref = row.get("claim_reference") or f"CLM-IMP-{uuid.uuid4().hex[:6].upper()}"
            existing = db.query(Claim).filter(Claim.claim_reference == claim_ref).first()
            if existing:
                claim_ref = f"{claim_ref}-{uuid.uuid4().hex[:4].upper()}"

            claim_in = ClaimCreate(
                claim_reference=claim_ref,
                farmer_name=str(row.get("farmer_name") or f"Farmer {idx+1}"),
                policy_reference=str(row.get("policy_reference") or f"POL-IMP-{idx+1000}"),
                insurance_scheme=str(row.get("insurance_scheme") or "PMFBY"),
                state=str(row.get("state") or "Maharashtra"),
                district=str(row.get("district") or "Solapur"),
                village=str(row.get("village") or "Village-A"),
                crop_type=str(row.get("crop_type") or "Paddy"),
                season=str(row.get("season") or "Kharif"),
                sowing_date=str(row.get("sowing_date") or "2025-06-15"),
                claim_start_date=str(row.get("claim_start_date") or "2025-07-01"),
                claim_end_date=str(row.get("claim_end_date") or "2025-11-15"),
                reported_loss_pct=float(row.get("reported_loss_pct", 45.0)) if pd.notna(row.get("reported_loss_pct")) else None,
                loss_description=str(row.get("loss_description") or "Drought induced loss"),
                growth_stage=str(row.get("growth_stage") or "Vegetative"),
                cultivated_area=float(row.get("cultivated_area", 2.0)) if pd.notna(row.get("cultivated_area")) else 2.0,
                soil_type=str(row.get("soil_type") or "Black Clay"),
                irrigation_type=str(row.get("irrigation_type") or "Rainfed"),
                observed_rainfall=float(row.get("observed_rainfall", 300.0)),
                reference_rainfall=float(row.get("reference_rainfall", 800.0)),
                soil_moisture=float(row.get("soil_moisture", 20.0)) if pd.notna(row.get("soil_moisture")) else None,
                observed_temperature=float(row.get("observed_temperature", 34.0)),
                reference_temperature=float(row.get("reference_temperature", 30.0)),
                current_ndvi=float(row.get("current_ndvi", 0.35)),
                reference_ndvi=float(row.get("reference_ndvi", 0.65)),
                historical_outcome=str(row.get("historical_outcome")) if pd.notna(row.get("historical_outcome")) else None,
                is_demo_record=ds.is_synthetic
            )
            create_claim(db=db, claim_in=claim_in, actor=f"Dataset Import ({ds.name})")
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")

    ds.import_status = "Imported"
    db.commit()

    return {
        "dataset_id": ds.id,
        "dataset_name": ds.name,
        "rows_processed": len(subset),
        "claims_created": imported_count,
        "errors_count": len(errors),
        "message": f"Successfully imported {imported_count} claims into database from dataset '{ds.name}'."
    }

@router.get("/datasets/template/download")
def download_template():
    template_path = generate_csv_template()
    return FileResponse(
        template_path,
        media_type="text/csv",
        filename="xai_cropinsure_template.csv"
    )

@router.post("/datasets/demo/load")
def load_synthetic_demo_data(num_samples: int = 150, db: Session = Depends(get_db)):
    """
    Generates and imports reproducible synthetic agricultural dataset and registers demo claims.
    Clearly tags everything as synthetic demonstration data.
    """
    demo_file = os.path.join(settings.DATA_DIR, "demo", "synthetic_crop_claims_demo.csv")
    df = generate_synthetic_agricultural_data(num_samples=num_samples, random_seed=42, save_path=demo_file)

    # Register in DB
    existing = db.query(ImportedDataset).filter(ImportedDataset.name == "Synthetic PMFBY Benchmark Dataset").first()
    if not existing:
        ds = register_imported_dataset(
            db=db,
            name="Synthetic PMFBY Benchmark Dataset",
            file_path=demo_file,
            category="Historical Claims & Payouts",
            source="Synthetic Generator (Seed 42)",
            is_synthetic=True,
            actor="System"
        )
    else:
        ds = existing

    # Populate 15 sample claims into claims table for immediate exploration
    populated_claims = 0
    if db.query(Claim).count() < 10:
        sample_df = df.head(15)
        for _, row in sample_df.iterrows():
            try:
                claim_in = ClaimCreate(
                    claim_reference=row["claim_reference"],
                    farmer_name=row["farmer_name"],
                    policy_reference=row["policy_reference"],
                    insurance_scheme=row["insurance_scheme"],
                    state=row["state"],
                    district=row["district"],
                    village=row["village"],
                    crop_type=row["crop_type"],
                    season=row["season"],
                    sowing_date=row["sowing_date"],
                    claim_start_date=row["claim_start_date"],
                    claim_end_date=row["claim_end_date"],
                    reported_loss_pct=row.get("reported_loss_pct"),
                    loss_description=row.get("loss_description"),
                    growth_stage=row.get("growth_stage"),
                    cultivated_area=row["cultivated_area"],
                    soil_type=row.get("soil_type"),
                    irrigation_type=row.get("irrigation_type"),
                    observed_rainfall=row["observed_rainfall"],
                    reference_rainfall=row["reference_rainfall"],
                    soil_moisture=row.get("soil_moisture"),
                    observed_temperature=row["observed_temperature"],
                    reference_temperature=row["reference_temperature"],
                    current_ndvi=row["current_ndvi"],
                    reference_ndvi=row["reference_ndvi"],
                    historical_outcome=row.get("historical_outcome"),
                    is_demo_record=True
                )
                create_claim(db=db, claim_in=claim_in, actor="Synthetic Data Loader")
                populated_claims += 1
            except Exception:
                pass

    return {
        "message": "Demonstration dataset generated and loaded successfully.",
        "dataset_id": ds.id,
        "dataset_name": ds.name,
        "rows_generated": len(df),
        "demo_claims_created": populated_claims,
        "provenance": "SYNTHETIC DEMONSTRATION DATA — NOT REAL FARMER OR INSURANCE RECORDS."
    }

