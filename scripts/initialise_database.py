import sys
import os
import json
import pandas as pd

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database.session import engine, Base, SessionLocal
from backend.app.database.models import Claim, ImportedDataset, TrainedModel
from backend.app.ml.synthetic_generator import generate_synthetic_agricultural_data
from backend.app.services.dataset_service import register_imported_dataset, generate_csv_template
from backend.app.ml.trainer import ModelTrainingPipeline
from backend.app.services.claim_service import create_claim
from backend.app.schemas.claim import ClaimCreate
from backend.app.config import settings

def init_db():
    print("=" * 65)
    print("XAI-CropInsure: Database & Machine Learning Initialiser")
    print("=" * 65)

    # 1. Create tables
    print("[1/5] Creating database tables in SQLite...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 2. Generate CSV template
    print("[2/5] Creating standard CSV data template...")
    tmpl_path = generate_csv_template()
    print(f"      Template created at: {tmpl_path}")

    # 3. Generate synthetic benchmark data
    print("[3/5] Generating synthetic benchmark agricultural dataset...")
    demo_file = os.path.join(settings.DATA_DIR, "demo", "synthetic_crop_claims_demo.csv")
    df = generate_synthetic_agricultural_data(num_samples=300, random_seed=42, save_path=demo_file)

    # Register dataset in DB
    existing_ds = db.query(ImportedDataset).filter(ImportedDataset.name == "Synthetic PMFBY Benchmark Dataset").first()
    if not existing_ds:
        ds = register_imported_dataset(
            db=db,
            name="Synthetic PMFBY Benchmark Dataset",
            file_path=demo_file,
            category="Historical Claims & Payouts",
            source="Synthetic Generator (Seed 42)",
            is_synthetic=True,
            actor="System Init"
        )
        print(f"      Registered dataset ID: {ds.id}")
    else:
        ds = existing_ds
        print(f"      Dataset already registered: ID {ds.id}")

    # 4. Train initial baseline classification model
    print("[4/5] Training baseline Random Forest Classifier with held-out validation...")
    existing_clf = db.query(TrainedModel).filter(TrainedModel.task_type == "classification").first()
    if not existing_clf:
        pipeline_trainer = ModelTrainingPipeline(random_state=42)
        res = pipeline_trainer.train_model(
            df=df,
            task_type="classification",
            algorithm="Random Forest",
            target_column="historical_outcome",
            model_name="Baseline Random Forest (Historical Outcome)",
            dataset_name=ds.name,
            is_synthetic=True
        )

        clf_model = TrainedModel(
            model_name=res["model_name"],
            model_version=res["model_version"],
            task_type=res["task_type"],
            algorithm=res["algorithm"],
            target_column=res["target_column"],
            features_used=json.dumps(res["features_used"]),
            metrics_json=json.dumps(res["metrics"]),
            file_path=res["file_path"],
            is_synthetic_trained=True,
            is_active=True,
            dataset_name=res["dataset_name"],
            training_notes=res["training_notes"]
        )
        db.add(clf_model)
        db.commit()
        print(f"      Model trained: {clf_model.model_version} | Accuracy: {res['metrics'].get('accuracy')} | F1: {res['metrics'].get('f1_score')}")
    else:
        print(f"      Active classification model already exists: {existing_clf.model_version}")

    # 5. Populate initial demonstration claims if table is empty
    print("[5/5] Checking demonstration claims...")
    if db.query(Claim).count() == 0:
        sample_df = df.head(12)
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
                create_claim(db=db, claim_in=claim_in, actor="System Init")
            except Exception as e:
                print(f"      Warning creating sample claim: {e}")
        print(f"      Seeded {db.query(Claim).count()} demonstration claims.")
    else:
        print(f"      Existing claims found ({db.query(Claim).count()} claims in database).")

    db.close()
    print("=" * 65)
    print("Database initialisation and baseline model training complete!")
    print("=" * 65)

if __name__ == "__main__":
    init_db()

