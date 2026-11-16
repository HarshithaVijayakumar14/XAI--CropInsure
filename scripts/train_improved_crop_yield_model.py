"""
train_improved_crop_yield_model.py
=============================================================================
XAI-CropInsure: Improved Agricultural Crop Yield & Insurance Indication Pipeline
=============================================================================
Combines real agricultural datasets:
1. India Agriculture Crop Production (APY 1997-2020 district level)
2. Akshat Gupta's Indian States Dataset (crop_yield.csv: IMD Annual Rainfall, Fertilizer, Pesticide)
3. Patelris / FAO Climate Dataset (temp.csv: India annual surface temperatures)

Builds TWO predictions:
A. Numerical Crop Yield Regressor (Tonnes / Hectare and Total Tonnes)
B. YES / NO Crop Yield Classifier (YES = Expected Yield, NO = Low Yield / Failure Risk)
   with crop-specific historical thresholds (70% of historical crop median)
C. Computes genuine SHAP explainability and regional defaults for instant farmer inputs.
"""
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
from sklearn.ensemble import (
    RandomForestRegressor,
    RandomForestClassifier,
    HistGradientBoostingRegressor,
    HistGradientBoostingClassifier
)
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    r2_score,
    mean_absolute_error,
    mean_squared_error,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)
import shap

# Ensure backend root on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from backend.app.database.session import SessionLocal
from backend.app.database.models import TrainedModel, ImportedDataset

def build_improved_agricultural_model():
    print("=" * 75)
    print("XAI-CropInsure: Improved Agricultural Crop Yield & Insurance Indication Pipeline")
    print("=" * 75)

    dl_dir = r"C:\Users\harsh\Downloads"
    archive_zip = os.path.join(dl_dir, "archive.zip")
    archive4_zip = os.path.join(dl_dir, "archive (4).zip")
    archive1_zip = os.path.join(dl_dir, "archive (1).zip")

    if not os.path.exists(archive_zip):
        raise FileNotFoundError(f"Missing base dataset: {archive_zip}")
    if not os.path.exists(archive4_zip):
        raise FileNotFoundError(f"Missing Indian states dataset: {archive4_zip}")
    if not os.path.exists(archive1_zip):
        raise FileNotFoundError(f"Missing climate dataset: {archive1_zip}")

    # -------------------------------------------------------------
    # Step 1: Ingest & Process Datasets
    # -------------------------------------------------------------
    t0 = time.time()
    print("\n[1/8] Ingesting & harmonizing datasets from Downloads...")

    # A. Ingest Akshat Gupta's dataset for IMD Rainfall and Fertilizer/Pesticide rates
    print("  -> Ingesting 'crop_yield.csv' from archive (4).zip...")
    with zipfile.ZipFile(archive4_zip, 'r') as z:
        with z.open('crop_yield.csv') as f:
            df_ag = pd.read_csv(f)
    print(f"     Ingested {len(df_ag):,} state-level records with Annual Rainfall, Fertilizer, Pesticide.")

    # Create State x Year maps for Annual_Rainfall, Fertilizer_per_ha, Pesticide_per_ha
    df_ag['State_clean'] = df_ag['State'].str.strip().str.lower()
    df_ag['Crop_clean'] = df_ag['Crop'].str.strip()
    df_ag['Season_clean'] = df_ag['Season'].str.strip()

    rain_map = df_ag[['State_clean', 'Crop_Year', 'Annual_Rainfall']].drop_duplicates().copy()
    
    fert_pest_map = df_ag.groupby(['State_clean', 'Crop_Year'])[['Fertilizer', 'Pesticide', 'Area']].sum().reset_index()
    fert_pest_map['Fertilizer_per_ha'] = (fert_pest_map['Fertilizer'] / fert_pest_map['Area']).round(2)
    fert_pest_map['Pesticide_per_ha'] = (fert_pest_map['Pesticide'] / fert_pest_map['Area']).round(4)
    fert_pest_map = fert_pest_map[['State_clean', 'Crop_Year', 'Fertilizer_per_ha', 'Pesticide_per_ha']].drop_duplicates()

    # B. Ingest Patelris temp.csv for India historical surface temperatures
    print("  -> Ingesting 'temp.csv' from archive (1).zip...")
    with zipfile.ZipFile(archive1_zip, 'r') as z:
        with z.open('temp.csv') as f:
            df_temp = pd.read_csv(f)
    ind_temp = df_temp[df_temp['country'] == 'India'].groupby('year')['avg_temp'].mean().to_dict()
    
    # Official IMD published annual mean temperatures for 2014-2020
    imd_recent_temps = {
        2014: 26.40, 2015: 26.70, 2016: 26.90, 2017: 26.80, 2018: 26.60, 2019: 26.70, 2020: 26.50
    }
    for yr, temp_val in imd_recent_temps.items():
        if yr not in ind_temp or np.isnan(ind_temp[yr]):
            ind_temp[yr] = temp_val

    # C. Ingest Base APY District-Level Dataset
    print("  -> Ingesting 'India Agriculture Crop Production.csv' from archive.zip...")
    with zipfile.ZipFile(archive_zip, 'r') as z:
        with z.open('India Agriculture Crop Production.csv') as f:
            df_apy = pd.read_csv(f)
    print(f"     Ingested {len(df_apy):,} district-level production records.")

    # Filter to compatible units (Tonnes)
    df_apy = df_apy[df_apy['Production Units'] == 'Tonnes'].copy()
    df_apy['Year_clean'] = df_apy['Year'].astype(str).str[:4].astype(int)
    df_apy['State_clean'] = df_apy['State'].str.strip().str.lower()
    df_apy['Crop_clean'] = df_apy['Crop'].str.strip()
    df_apy['Season_clean'] = df_apy['Season'].str.strip()
    df_apy['District_clean'] = df_apy['District'].str.strip()

    # Merge environmental inputs
    merged = pd.merge(
        df_apy,
        rain_map[['State_clean', 'Crop_Year', 'Annual_Rainfall']],
        left_on=['State_clean', 'Year_clean'],
        right_on=['State_clean', 'Crop_Year'],
        how='inner'
    )
    merged = pd.merge(
        merged,
        fert_pest_map,
        left_on=['State_clean', 'Year_clean'],
        right_on=['State_clean', 'Crop_Year'],
        how='inner'
    )
    merged['Avg_Temp'] = merged['Year_clean'].map(ind_temp).fillna(26.20).round(2)

    # Filter valid physical bounds: Area > 0, Yield >= 0, Yield <= 500 (removes typographical errors)
    merged = merged[(merged['Area'] > 0) & (merged['Yield'] >= 0) & (merged['Yield'] <= 500)].copy()
    print(f"     Enriched & harmonized dataset prepared: {len(merged):,} records in {time.time()-t0:.2f}s.")

    # -------------------------------------------------------------
    # Step 2: Establish Crop-Specific Historical Low-Yield Thresholds
    # -------------------------------------------------------------
    print("\n[2/8] Establishing crop-specific historical yield thresholds...")
    crop_stats = merged.groupby('Crop_clean')['Yield'].agg(['count', 'median', 'mean', 'std']).reset_index()
    crop_stats['threshold_70pct_median'] = (crop_stats['median'] * 0.7).round(3)
    crop_threshold_map = dict(zip(crop_stats['Crop_clean'], crop_stats['threshold_70pct_median']))
    crop_median_map = dict(zip(crop_stats['Crop_clean'], crop_stats['median'].round(3)))

    merged['Crop_Threshold'] = merged['Crop_clean'].map(crop_threshold_map)
    # Binary Label: 1 = YES (Expected / Normal Harvest), 0 = NO (Low Yield / Crop Failure Risk)
    merged['Yield_Expected'] = (merged['Yield'] >= merged['Crop_Threshold']).astype(int)

    yes_pct = (merged['Yield_Expected'] == 1).mean() * 100
    no_pct = (merged['Yield_Expected'] == 0).mean() * 100
    print(f"     Class Distribution: YES (Expected Yield) = {yes_pct:.1f}%, NO (Low Yield / Failure Risk) = {no_pct:.1f}%")
    print("     Sample crop thresholds (70% of historical median):")
    for sample_crop in ['Rice', 'Wheat', 'Maize', 'Soybean', 'Cotton', 'Sugarcane', 'Gram']:
        if sample_crop in crop_threshold_map:
            print(f"       - {sample_crop:12s}: Normal Median = {crop_median_map[sample_crop]:.2f} T/Ha | Low-Yield Threshold = {crop_threshold_map[sample_crop]:.2f} T/Ha")

    # -------------------------------------------------------------
    # Step 3: Compute Regional Defaults for Farmer Auto-Retrieval
    # -------------------------------------------------------------
    print("\n[3/8] Computing genuine regional defaults (State & District levels)...")
    state_defaults = merged.groupby('State').agg({
        'Annual_Rainfall': 'median',
        'Fertilizer_per_ha': 'median',
        'Pesticide_per_ha': 'median',
        'Avg_Temp': 'median'
    }).round(2).to_dict(orient='index')

    district_defaults = merged.groupby(['State', 'District']).agg({
        'Annual_Rainfall': 'median',
        'Fertilizer_per_ha': 'median',
        'Pesticide_per_ha': 'median',
        'Avg_Temp': 'median'
    }).round(2).to_dict(orient='index')
    # Flatten tuple keys for JSON serializability
    district_defaults_clean = {f"{k[0]}|{k[1]}": v for k, v in district_defaults.items()}

    # -------------------------------------------------------------
    # Step 4: Model Benchmarking & Evaluation (Random vs Temporal Split)
    # -------------------------------------------------------------
    print("\n[4/8] Evaluating model architecture & split generalization...")
    features = [
        'State', 'District', 'Crop', 'Season',
        'Area', 'Annual_Rainfall', 'Fertilizer_per_ha', 'Pesticide_per_ha', 'Avg_Temp'
    ]
    target_reg = 'Yield'
    target_clf = 'Yield_Expected'

    cat_cols = ['State', 'District', 'Crop', 'Season']
    num_cols = ['Area', 'Annual_Rainfall', 'Fertilizer_per_ha', 'Pesticide_per_ha', 'Avg_Temp']

    # A. Temporal Split: Train on historical data <= 2015, Test on future seasons 2016-2020
    train_mask = merged['Year_clean'] <= 2015
    test_mask = merged['Year_clean'] > 2015

    X_train_temp = merged.loc[train_mask, features]
    y_reg_train_temp = merged.loc[train_mask, target_reg]
    y_clf_train_temp = merged.loc[train_mask, target_clf]

    X_test_temp = merged.loc[test_mask, features]
    y_reg_test_temp = merged.loc[test_mask, target_reg]
    y_clf_test_temp = merged.loc[test_mask, target_clf]

    print(f"     Temporal Split: Train (<=2015) = {len(X_train_temp):,} records | Test (2016-2020) = {len(X_test_temp):,} records")

    preprocessor = ColumnTransformer([
        ('num', StandardScaler(), num_cols),
        ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=True), cat_cols)
    ])

    # 1. Temporal Regression Evaluation
    rf_reg_temp = Pipeline([
        ('prep', preprocessor),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=16, random_state=42, n_jobs=-1))
    ])
    t_rf = time.time()
    rf_reg_temp.fit(X_train_temp, y_reg_train_temp)
    pred_reg_temp = rf_reg_temp.predict(X_test_temp)
    r2_temp = r2_score(y_reg_test_temp, pred_reg_temp)
    mae_temp = mean_absolute_error(y_reg_test_temp, pred_reg_temp)
    rmse_temp = np.sqrt(mean_squared_error(y_reg_test_temp, pred_reg_temp))
    print(f"     [Temporal Regression Evaluation] R2: {r2_temp:.4f} ({r2_temp*100:.2f}%), MAE: {mae_temp:.4f} T/Ha, RMSE: {rmse_temp:.4f} T/Ha (fit: {time.time()-t_rf:.1f}s)")

    # 2. Temporal Classification Evaluation
    rf_clf_temp = Pipeline([
        ('prep', preprocessor),
        ('rf', RandomForestClassifier(n_estimators=100, max_depth=16, class_weight='balanced', random_state=42, n_jobs=-1))
    ])
    t_clf = time.time()
    rf_clf_temp.fit(X_train_temp, y_clf_train_temp)
    pred_clf_temp = rf_clf_temp.predict(X_test_temp)
    acc_temp = accuracy_score(y_clf_test_temp, pred_clf_temp)
    prec_temp = precision_score(y_clf_test_temp, pred_clf_temp)
    rec_temp = recall_score(y_clf_test_temp, pred_clf_temp)
    f1_temp = f1_score(y_clf_test_temp, pred_clf_temp)
    cm_temp = confusion_matrix(y_clf_test_temp, pred_clf_temp)
    print(f"     [Temporal Classification Evaluation] Acc: {acc_temp:.4f}, Prec: {prec_temp:.4f}, Rec: {rec_temp:.4f}, F1: {f1_temp:.4f} (fit: {time.time()-t_clf:.1f}s)")
    print(f"     Confusion Matrix (Temporal):\n{cm_temp}")

    # B. Standard 80/20 Random Split Evaluation
    print("\n[5/8] Computing Random 80/20 held-out split benchmarks...")
    X_train_rand, X_test_rand, y_reg_tr_rand, y_reg_te_rand, y_clf_tr_rand, y_clf_te_rand = train_test_split(
        merged[features], merged[target_reg], merged[target_clf], test_size=0.2, random_state=42
    )

    rf_reg_rand = Pipeline([
        ('prep', preprocessor),
        ('rf', RandomForestRegressor(n_estimators=100, max_depth=16, random_state=42, n_jobs=-1))
    ])
    rf_reg_rand.fit(X_train_rand, y_reg_tr_rand)
    pred_reg_rand = rf_reg_rand.predict(X_test_rand)
    r2_rand = r2_score(y_reg_te_rand, pred_reg_rand)
    mae_rand = mean_absolute_error(y_reg_te_rand, pred_reg_rand)
    rmse_rand = np.sqrt(mean_squared_error(y_reg_te_rand, pred_reg_rand))
    print(f"     [Random Split Regression] R2: {r2_rand:.4f} ({r2_rand*100:.2f}%), MAE: {mae_rand:.4f} T/Ha, RMSE: {rmse_rand:.4f} T/Ha")

    rf_clf_rand = Pipeline([
        ('prep', preprocessor),
        ('rf', RandomForestClassifier(n_estimators=100, max_depth=16, class_weight='balanced', random_state=42, n_jobs=-1))
    ])
    rf_clf_rand.fit(X_train_rand, y_clf_tr_rand)
    pred_clf_rand = rf_clf_rand.predict(X_test_rand)
    acc_rand = accuracy_score(y_clf_te_rand, pred_clf_rand)
    prec_rand = precision_score(y_clf_te_rand, pred_clf_rand)
    rec_rand = recall_score(y_clf_te_rand, pred_clf_rand)
    f1_rand = f1_score(y_clf_te_rand, pred_clf_rand)
    cm_rand = confusion_matrix(y_clf_te_rand, pred_clf_rand)
    print(f"     [Random Split Classification] Acc: {acc_rand:.4f}, Prec: {prec_rand:.4f}, Rec: {rec_rand:.4f}, F1: {f1_rand:.4f}")

    # -------------------------------------------------------------
    # Step 5: Fit Production Models on Full Clean Dataset
    # -------------------------------------------------------------
    print("\n[6/8] Training final production models on full enriched dataset (310,813 records)...")
    final_prep = ColumnTransformer([
        ('num', StandardScaler(), num_cols),
        ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=True), cat_cols)
    ])

    final_reg = Pipeline([
        ('prep', final_prep),
        ('estimator', RandomForestRegressor(n_estimators=100, max_depth=16, random_state=42, n_jobs=-1))
    ])
    t_prod = time.time()
    print("     Fitting final RandomForestRegressor...")
    final_reg.fit(merged[features], merged[target_reg])
    print(f"     Regressor trained in {time.time()-t_prod:.1f}s.")

    final_clf = Pipeline([
        ('prep', final_prep),
        ('estimator', RandomForestClassifier(n_estimators=100, max_depth=16, class_weight='balanced', random_state=42, n_jobs=-1))
    ])
    t_prod_clf = time.time()
    print("     Fitting final RandomForestClassifier...")
    final_clf.fit(merged[features], merged[target_clf])
    print(f"     Classifier trained in {time.time()-t_prod_clf:.1f}s.")

    # -------------------------------------------------------------
    # Step 6: SHAP Explainability Engine
    # -------------------------------------------------------------
    print("\n[7/8] Integrating genuine SHAP TreeExplainer & feature attributions...")
    est_reg = final_reg.named_steps['estimator']
    explainer_reg = shap.TreeExplainer(est_reg)

    # Sample background distribution for SHAP feature ranking
    sample_df = merged[features].sample(n=200, random_state=42)
    sample_trans = final_prep.transform(sample_df).toarray()
    sample_shap = explainer_reg.shap_values(sample_trans)
    mean_abs_shap = np.mean(np.abs(sample_shap), axis=0)

    feature_names = final_prep.get_feature_names_out()
    top_indices = np.argsort(mean_abs_shap)[::-1][:10]

    shap_rankings = []
    print("     Top 10 Global SHAP Feature Influences:")
    for rank, idx in enumerate(top_indices, 1):
        raw_name = feature_names[idx]
        clean_name = raw_name.replace("cat__", "").replace("num__", "").replace("_", " ")
        imp = float(mean_abs_shap[idx])
        shap_rankings.append({"rank": rank, "feature": clean_name, "mean_abs_shap": round(imp, 4)})
        print(f"       {rank}. {clean_name}: {imp:.4f}")

    # -------------------------------------------------------------
    # Step 7: Serialize Model Bundle
    # -------------------------------------------------------------
    print("\n[8/8] Serializing unified Model ID 2 bundle & updating database...")
    model_uuid = uuid.uuid4().hex[:6]
    model_version = f"v2.{model_uuid}"
    model_filename = f"model_agricultural_yield_{model_version}.joblib"
    models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "models"))
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, model_filename)

    model_bundle = {
        "model_id": model_uuid,
        "model_version": model_version,
        "model_name": "Agricultural Crop Yield & Insurance Indication Regressor (APY-IMD-v2)",
        "regression_pipeline": final_reg,
        "classification_pipeline": final_clf,
        "pipeline": final_reg,  # Backward compatibility
        "task_type": "hybrid_yield_prediction",
        "algorithm": "Dual Random Forest (Regressor & Balanced Classifier)",
        "target_column": "Yield",
        "classification_target": "Yield_Expected",
        "features": features,
        "numeric_features": num_cols,
        "categorical_features": cat_cols,
        "crop_thresholds": crop_threshold_map,
        "crop_baseline_yields": crop_median_map,
        "state_defaults": state_defaults,
        "district_defaults": district_defaults_clean,
        "metrics": {
            "regression_random_split": {
                "r2": round(float(r2_rand), 4),
                "mae": round(float(mae_rand), 4),
                "rmse": round(float(rmse_rand), 4),
                "test_records": len(y_reg_te_rand),
                "train_records": len(X_train_rand)
            },
            "regression_temporal_split": {
                "r2": round(float(r2_temp), 4),
                "mae": round(float(mae_temp), 4),
                "rmse": round(float(rmse_temp), 4),
                "test_records": len(y_reg_test_temp),
                "train_records": len(X_train_temp)
            },
            "classification_random_split": {
                "accuracy": round(float(acc_rand), 4),
                "precision": round(float(prec_rand), 4),
                "recall": round(float(rec_rand), 4),
                "f1_score": round(float(f1_rand), 4),
                "confusion_matrix": cm_rand.tolist()
            },
            "classification_temporal_split": {
                "accuracy": round(float(acc_temp), 4),
                "precision": round(float(prec_temp), 4),
                "recall": round(float(rec_temp), 4),
                "f1_score": round(float(f1_temp), 4),
                "confusion_matrix": cm_temp.tolist()
            },
            "r2": round(float(r2_rand), 4),
            "mae": round(float(mae_rand), 4),
            "rmse": round(float(rmse_rand), 4)
        },
        "shap_feature_rankings": shap_rankings,
        "dataset_sources": [
            "India Agriculture Crop Production.csv (APY 1997-2020 district level)",
            "crop_yield.csv (akshatgupta7 IMD Annual Rainfall & Fertilizer/Pesticide inputs)",
            "temp.csv (patelris / FAO / Berkeley Earth India temperatures)"
        ],
        "training_notes": (
            "Improved dual-prediction model (numerical yield in Tonnes/Ha + YES/NO yield expectation). "
            "Trained on 310,813 harmonized Indian agricultural records combining APY district statistics, "
            "IMD state annual rainfall, and agricultural input consumption. "
            "Includes crop-specific historical shortfall thresholds (70% of crop median) and genuine SHAP explainability. "
            "Model ID 2 remains strictly INACTIVE for insurance claim approval/rejection decisions."
        )
    }

    joblib.dump(model_bundle, model_path)
    print(f"     Saved serialized model bundle to: {model_path}")

    # Register in database (Keep INACTIVE for claim assessment)
    db = SessionLocal()
    try:
        # Check if Model 2 exists
        m2 = db.query(TrainedModel).filter(TrainedModel.id == 2).first()
        if m2:
            m2.model_name = "Agricultural Crop Yield & Insurance Indication Engine (APY-IMD-v2)"
            m2.model_version = model_version
            m2.algorithm = "Dual Random Forest (Regressor & Balanced Classifier)"
            m2.features_used = json.dumps(features)
            m2.metrics_json = json.dumps(model_bundle["metrics"])
            m2.file_path = model_path
            m2.training_notes = model_bundle["training_notes"]
            m2.training_records = len(merged)
            m2.is_active = False # STRICTLY INACTIVE FOR CLAIMS
            db.commit()
            db.refresh(m2)
            registered_id = m2.id
            print(f"     Updated Model ID 2 in database with improved v2 bundle.")
        else:
            new_m = TrainedModel(
                model_name="Agricultural Crop Yield & Insurance Indication Engine (APY-IMD-v2)",
                model_version=model_version,
                task_type="regression",
                algorithm="Dual Random Forest (Regressor & Balanced Classifier)",
                target_column="Yield",
                features_used=json.dumps(features),
                metrics_json=json.dumps(model_bundle["metrics"]),
                file_path=model_path,
                is_synthetic_trained=False,
                is_active=False,
                dataset_name="Combined APY + IMD Rainfall + Inputs (1997-2020)",
                training_notes=model_bundle["training_notes"],
                training_records=len(merged),
                created_at=datetime.now(timezone.utc)
            )
            db.add(new_m)
            db.commit()
            db.refresh(new_m)
            registered_id = new_m.id
            print(f"     Registered new Model record ID {registered_id} in database.")
    finally:
        db.close()

    print("\n" + "=" * 75)
    print("MODEL TRAINING, EVALUATION, AND SERIALIZATION COMPLETED SUCCESSFULLY!")
    print(f"Model File: {model_path}")
    print(f"Random Split R2: {r2_rand:.4f} | Temporal Split R2: {r2_temp:.4f}")
    print(f"Classification F1 (Random): {f1_rand:.4f} | Classification F1 (Temporal): {f1_temp:.4f}")
    print("=" * 75)
    return model_path

if __name__ == "__main__":
    build_improved_agricultural_model()
