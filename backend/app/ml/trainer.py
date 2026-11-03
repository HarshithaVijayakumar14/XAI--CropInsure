import os
import json
import uuid
from typing import Dict, Any, List, Tuple, Optional
import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.pipeline import Pipeline

from backend.app.ml.preprocessing import build_preprocessor, DEFAULT_NUMERIC_FEATURES, DEFAULT_CATEGORICAL_FEATURES
from backend.app.ml.feature_engineering import compute_agricultural_features
from backend.app.config import settings

CLASSIFIERS = {
    "Random Forest": lambda rs: RandomForestClassifier(n_estimators=100, max_depth=8, random_state=rs),
    "Gradient Boosting": lambda rs: GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=rs),
    "Logistic Regression": lambda rs: LogisticRegression(max_iter=1000, random_state=rs),
    "Decision Tree": lambda rs: DecisionTreeClassifier(max_depth=6, random_state=rs)
}

REGRESSORS = {
    "Linear Regression": lambda rs: LinearRegression(),
    "Random Forest Regressor": lambda rs: RandomForestRegressor(n_estimators=100, max_depth=8, random_state=rs),
    "Gradient Boosting Regressor": lambda rs: GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=5, random_state=rs)
}

class ModelTrainingPipeline:
    def __init__(self, random_state: int = 42):
        self.random_state = random_state

    def train_model(
        self,
        df: pd.DataFrame,
        task_type: str,
        algorithm: str,
        target_column: str,
        features: Optional[List[str]] = None,
        test_size: float = 0.2,
        model_name: Optional[str] = None,
        dataset_name: Optional[str] = None,
        is_synthetic: bool = True
    ) -> Dict[str, Any]:
        """
        Trains and validates an ML model with strict data leakage prevention and held-out evaluation.
        """
        # 1. Feature Engineering
        data, warnings = compute_agricultural_features(df)

        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset columns: {list(data.columns)}")

        # Drop rows missing the target
        data = data.dropna(subset=[target_column]).copy()
        if len(data) < 20:
            raise ValueError(f"Insufficient training samples ({len(data)} rows). Need at least 20 labelled rows.")

        # Determine feature subsets
        available_numeric = [f for f in DEFAULT_NUMERIC_FEATURES if f in data.columns]
        available_cat = [f for f in DEFAULT_CATEGORICAL_FEATURES if f in data.columns]

        if features:
            available_numeric = [f for f in features if f in available_numeric]
            available_cat = [f for f in features if f in available_cat]

        if not available_numeric and not available_cat:
            raise ValueError("No usable features found for training.")

        X = data[available_numeric + available_cat].copy()
        y = data[target_column].copy()

        # Target encoding for classification
        label_mapping = None
        if task_type == "classification":
            unique_vals = list(y.unique())
            # Standardize binary classes if Approved / Rejected
            if set(unique_vals) <= {"Approved", "Rejected", "approved", "rejected", 0, 1}:
                y_clean = y.astype(str).str.strip().str.capitalize()
                # 1 = Approved, 0 = Rejected
                label_mapping = {"Approved": 1, "Rejected": 0}
                y = y_clean.map(label_mapping)
                if y.isna().any():
                    y = y.fillna(0).astype(int)
                else:
                    y = y.astype(int)
            else:
                # Factorize
                codes, uniques = pd.factorize(y)
                y = pd.Series(codes, index=y.index)
                label_mapping = {val: idx for idx, val in enumerate(uniques)}

            stratify = y if len(np.unique(y)) > 1 and min(pd.Series(y).value_counts()) >= 2 else None
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=self.random_state, stratify=stratify
            )
        else:
            # Regression target
            y = pd.to_numeric(y, errors='coerce').fillna(0.0)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=self.random_state
            )

        # Build Preprocessor
        preprocessor = build_preprocessor(available_numeric, available_cat)

        # Instantiate algorithm
        if task_type == "classification":
            estimator_factory = CLASSIFIERS.get(algorithm, CLASSIFIERS["Random Forest"])
        else:
            estimator_factory = REGRESSORS.get(algorithm, REGRESSORS["Random Forest Regressor"])
        
        estimator = estimator_factory(self.random_state)

        # Build Full Pipeline
        pipeline = Pipeline(steps=[
            ('preprocessor', preprocessor),
            ('estimator', estimator)
        ])

        # Fit strictly on X_train, y_train
        pipeline.fit(X_train, y_train)

        # Evaluate on held-out test set
        y_pred = pipeline.predict(X_test)
        metrics = {}

        if task_type == "classification":
            acc = float(accuracy_score(y_test, y_pred))
            prec = float(precision_score(y_test, y_pred, zero_division=0))
            rec = float(recall_score(y_test, y_pred, zero_division=0))
            f1 = float(f1_score(y_test, y_pred, zero_division=0))
            cm = confusion_matrix(y_test, y_pred).tolist()

            roc_auc = None
            if hasattr(pipeline, "predict_proba"):
                try:
                    y_prob = pipeline.predict_proba(X_test)[:, 1]
                    roc_auc = float(roc_auc_score(y_test, y_prob))
                except Exception:
                    roc_auc = None

            metrics = {
                "accuracy": round(acc, 4),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
                "confusion_matrix": cm,
                "positive_class": "Approved (1)",
                "test_samples": len(X_test),
                "train_samples": len(X_train)
            }
        else:
            mae = float(mean_absolute_error(y_test, y_pred))
            rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
            r2 = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 0.0
            metrics = {
                "mae": round(mae, 2),
                "rmse": round(rmse, 2),
                "r2_score": round(r2, 4),
                "target_unit": "INR",
                "test_samples": len(X_test),
                "train_samples": len(X_train)
            }

        # Model Version & Persistence
        model_version = f"v1.{uuid.uuid4().hex[:6]}"
        model_filename = f"model_{task_type}_{model_version}.joblib"
        model_dir = os.path.join(settings.DATA_DIR, "models")
        os.makedirs(model_dir, exist_ok=True)
        model_path = os.path.join(model_dir, model_filename)

        bundle = {
            "pipeline": pipeline,
            "task_type": task_type,
            "algorithm": algorithm,
            "numeric_features": available_numeric,
            "categorical_features": available_cat,
            "all_features": available_numeric + available_cat,
            "label_mapping": label_mapping,
            "metrics": metrics,
            "model_version": model_version,
            "is_synthetic": is_synthetic,
            "dataset_name": dataset_name,
            "X_train_sample": X_train.head(100) # Small sample for SHAP background if needed
        }

        joblib.dump(bundle, model_path)

        display_name = model_name or f"{algorithm} ({task_type.capitalize()})"

        return {
            "model_name": display_name,
            "model_version": model_version,
            "task_type": task_type,
            "algorithm": algorithm,
            "target_column": target_column,
            "features_used": available_numeric + available_cat,
            "metrics": metrics,
            "file_path": model_path,
            "is_synthetic_trained": is_synthetic,
            "dataset_name": dataset_name,
            "training_notes": f"Trained on {len(X_train)} samples, evaluated on {len(X_test)} samples."
        }

