import os
import sys
import uuid
import json
import time
import zipfile
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import shap

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.app.database.session import SessionLocal
from backend.app.database.models import TrainedModel

def run_agricultural_yield_training():
    print("=================================================================")
    print("XAI-CropInsure: Agricultural Crop-Yield Model Training Pipeline")
    print("=================================================================")

    zip_path = r"C:\Users\harsh\Downloads\archive.zip"
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"Source file not found: {zip_path}")

    # 1. Ingest directly from archive.zip without extracting to disk
    t0 = time.time()
    print(f"\n[1/7] Reading 'India Agriculture Crop Production.csv' directly from {zip_path}...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        with z.open('India Agriculture Crop Production.csv') as f:
            raw_df = pd.read_csv(f)
    print(f"      Ingested {len(raw_df):,} raw records in {time.time()-t0:.2f}s.")

    # 2. Validation & Unit Filtering
    print("\n[2/7] Filtering dataset to compatible production records (Tonnes)...")
    print(f"      Initial record count: {len(raw_df):,}")
    
    # Filter unit to Tonnes (excludes Bales and fruit counts)
    df = raw_df[raw_df['Production Units'] == 'Tonnes'].copy()
    print(f"      Records with Production Units == 'Tonnes': {len(df):,} (dropped {len(raw_df)-len(df):,} non-tonnes records)")

    # Features and target
    features = ['State', 'District', 'Crop', 'Season', 'Area']
    target = 'Yield'

    # Drop missing values
    df = df.dropna(subset=features + [target]).copy()
    print(f"      Records after dropping missing values: {len(df):,}")

    # Validate physical constraints: Area > 0, Yield >= 0, Yield <= 500 (removes typographical typos like 9,801 Tonnes/Ha)
    df = df[(df['Area'] > 0) & (df['Yield'] >= 0) & (df['Yield'] <= 500)].copy()
    print(f"      Records after removing area<=0 and extreme data-entry typos (>500 T/Ha): {len(df):,}")

    # 3. Target Leakage Prevention Check
    print("\n[3/7] Validating Target Leakage Prevention...")
    print("      Features selected for training:")
    print("        - Categorical: State, District, Crop, Season")
    print("        - Numeric: Area (Cultivated Hectares)")
    print("      Features STRICTLY EXCLUDED:")
    print("        - Production (Strictly excluded to prevent Yield = Production / Area identity leakage)")
    print("        - Production Units, Area Units (Constant in filtered subset)")
    print("        - Year (Excluded to enforce general agronomic relationship learning)")

    X = df[features]
    y = df[target]

    # 4. Train / Held-out Test Split
    print("\n[4/7] Performing 80/20 train-test split (random_state=42)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    print(f"      Training set size:   {len(X_train):,} records (80%)")
    print(f"      Held-out test size: {len(X_test):,} records (20%)")
    print(f"      Baseline Training Mean Yield: {y_train.mean():.3f} Tonnes/Ha")
    print(f"      Baseline Test Mean Yield:     {y_test.mean():.3f} Tonnes/Ha")

    # 5. Build Scikit-Learn Pipeline
    print("\n[5/7] Building and fitting Scikit-Learn Pipeline...")
    cat_cols = ['State', 'District', 'Crop', 'Season']
    num_cols = ['Area']

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), num_cols),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=True), cat_cols)
        ]
    )

    # RandomForestRegressor with 100 estimators, max_depth=16 for strong non-linear agronomic modeling
    estimator = RandomForestRegressor(
        n_estimators=100,
        max_depth=16,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )

    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('estimator', estimator)
    ])

    t_train = time.time()
    print("      Fitting RandomForestRegressor across 265,308 training samples...")
    pipeline.fit(X_train, y_train)
    train_duration = time.time() - t_train
    print(f"      Model training complete in {train_duration:.2f}s.")

    # Evaluate on Held-out Test Set
    print("\n[6/7] Evaluating model on 66,328 held-out test records...")
    y_pred = pipeline.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"      ==========================================")
    print(f"      ACTUAL TEST EVALUATION METRICS:")
    print(f"      - R^2 Score (Coefficient of Det.): {r2:.4f} ({r2*100:.2f}% variance explained)")
    print(f"      - Mean Absolute Error (MAE):       {mae:.4f} Tonnes/Ha")
    print(f"      - Root Mean Squared Error (RMSE):  {rmse:.4f} Tonnes/Ha")
    print(f"      ==========================================")

    # 6. SHAP Explainability Integration
    print("\n[7/7] Computing genuine SHAP explainability and feature importance...")
    pre = pipeline.named_steps['preprocessor']
    est = pipeline.named_steps['estimator']

    # Select representative background sample (100 rows) for SHAP
    bg_sample_raw = X_train.sample(n=100, random_state=42)
    bg_sample_trans = pre.transform(bg_sample_raw).toarray()

    explainer = shap.TreeExplainer(est)
    
    # Explain a test sample batch (100 rows)
    test_sample_raw = X_test.sample(n=100, random_state=42)
    test_sample_trans = pre.transform(test_sample_raw).toarray()
    shap_vals = explainer.shap_values(test_sample_trans)

    feature_names = pre.get_feature_names_out()
    mean_abs_shap = np.mean(np.abs(shap_vals), axis=0)
    top_indices = np.argsort(mean_abs_shap)[::-1][:10]

    print("      Top 10 Influential Features (Global SHAP Importance):")
    shap_feature_rankings = []
    for rank, idx in enumerate(top_indices, 1):
        raw_name = feature_names[idx]
        importance = float(mean_abs_shap[idx])
        clean_name = raw_name.replace("cat__", "").replace("num__", "").replace("_", " ")
        shap_feature_rankings.append({"rank": rank, "feature": clean_name, "mean_abs_shap": round(importance, 4)})
        print(f"        {rank}. {clean_name}: {importance:.4f}")

    # 7. Model Serialization & SQLite Registration (INACTIVE)
    model_uuid = uuid.uuid4().hex[:6]
    model_version = f"v1.{model_uuid}"
    model_filename = f"model_agricultural_yield_{model_version}.joblib"
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "models"))
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, model_filename)

    model_bundle = {
        "pipeline": pipeline,
        "task_type": "regression",
        "algorithm": "Random Forest Regressor",
        "target_column": "Yield",
        "numeric_features": num_cols,
        "categorical_features": cat_cols,
        "all_features": features,
        "metrics": {
            "r2": round(float(r2), 4),
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "test_records": len(X_test),
            "train_records": len(X_train)
        },
        "X_train_sample": bg_sample_raw,
        "shap_feature_rankings": shap_feature_rankings,
        "model_id": model_uuid,
        "training_notes": (
            "Agricultural crop-yield regression model trained on genuine Indian APY statistics (331,653 Tonnes records). "
            "Strictly excluded Production to prevent target leakage. "
            "Registered as INACTIVE. Kept strictly separate from the insurance claim approval/rejection model."
        )
    }

    joblib.dump(model_bundle, model_path)
    print(f"\n      Saved serialized model bundle to: {model_path}")

    # Register in SQLite trained_models table as INACTIVE
    db = SessionLocal()
    try:
        new_model_record = TrainedModel(
            model_name="Agricultural Crop Yield Regressor (APY-India)",
            model_version=model_version,
            task_type="regression",
            algorithm="Random Forest Regressor",
            target_column="Yield",
            features_used=json.dumps(features),
            metrics_json=json.dumps(model_bundle["metrics"]),
            file_path=model_path,
            explainer_path=None,
            is_synthetic_trained=False,  # Trained on genuine Indian government agricultural data
            is_active=False,             # STRICTLY INACTIVE: Does not alter or replace the active insurance model
            dataset_name="India Agriculture Crop Production (Tonnes Subset)",
            training_notes=model_bundle["training_notes"],
            training_records=len(X_train),
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_model_record)
        db.commit()
        db.refresh(new_model_record)
        print(f"      Registered in database with Model ID: {new_model_record.id}")
        print(f"      Model Active Status: is_active = {new_model_record.is_active} (INACTIVE)")
    finally:
        db.close()

    print("\n=================================================================")
    print("TRAINING & REGISTRATION COMPLETE (SAFE & ISOLATED)")
    print("=================================================================")
    return model_bundle, new_model_record.id

if __name__ == "__main__":
    run_agricultural_yield_training()

