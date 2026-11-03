import os
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import shap
import joblib

FEATURE_DISPLAY_NAMES = {
    "rainfall_deficit": "Rainfall Deficit (mm)",
    "relative_rainfall_deficit": "Relative Rainfall Deficit (%)",
    "ndvi_change": "NDVI Vegetation Change",
    "temperature_anomaly": "Temperature Anomaly (°C)",
    "soil_moisture": "Soil Moisture (%)",
    "cultivated_area": "Cultivated Area (Hectares)",
    "crop_type": "Crop Type",
    "season": "Crop Season",
    "state": "State / Region"
}

class ShapExplanationService:
    def __init__(self, model_bundle_path: str):
        if not os.path.exists(model_bundle_path):
            raise FileNotFoundError(f"Model file not found: {model_bundle_path}")
        self.bundle = joblib.load(model_bundle_path)
        self.pipeline = self.bundle["pipeline"]
        self.task_type = self.bundle["task_type"]
        self.algorithm = self.bundle["algorithm"]
        self.preprocessor = self.pipeline.named_steps["preprocessor"]
        self.estimator = self.pipeline.named_steps["estimator"]
        self.numeric_features = self.bundle["numeric_features"]
        self.categorical_features = self.bundle["categorical_features"]
        self.all_features = self.bundle["all_features"]
        self.background_sample = self.bundle.get("X_train_sample")

        # Initialize explainer
        self._init_explainer()

    def _init_explainer(self):
        """Initializes appropriate SHAP explainer based on model family."""
        if self.background_sample is not None and len(self.background_sample) > 0:
            X_bg_trans = self.preprocessor.transform(self.background_sample)
        else:
            # Fallback dummy sample
            dummy_data = pd.DataFrame(columns=self.all_features)
            X_bg_trans = np.zeros((1, 10))

        if "Forest" in self.algorithm or "Boosting" in self.algorithm or "Tree" in self.algorithm:
            self.explainer = shap.TreeExplainer(self.estimator)
        elif "Logistic" in self.algorithm or "Linear" in self.algorithm:
            self.explainer = shap.LinearExplainer(self.estimator, X_bg_trans)
        else:
            self.explainer = shap.Explainer(self.estimator, X_bg_trans)

    def _get_feature_names_out(self) -> List[str]:
        """Retrieves transformed feature names from ColumnTransformer."""
        try:
            return list(self.preprocessor.get_feature_names_out())
        except Exception:
            names = [f"num_{col}" for col in self.numeric_features]
            names += [f"cat_{col}" for col in self.categorical_features]
            return names

    def explain_instance(self, claim_df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generates local SHAP explanations for a single claim instance.
        Returns:
            - base_value
            - prediction
            - shap_contributions: list of individual feature impacts
        """
        # Ensure required columns exist
        for col in self.all_features:
            if col not in claim_df.columns:
                claim_df[col] = np.nan

        X_row = claim_df[self.all_features].head(1)
        X_trans = self.preprocessor.transform(X_row)
        transformed_feature_names = self._get_feature_names_out()

        # Compute SHAP values
        raw_shap_vals = self.explainer.shap_values(X_trans)

        # Handle binary classification dimensionality
        # In scikit-learn classifiers, raw_shap_vals can be list of [class 0, class 1] or array (1, n_features, 2)
        base_val = 0.0
        shap_vals_1d = None

        if isinstance(raw_shap_vals, list):
            # Class 1 (Approved / Valid Claim)
            if len(raw_shap_vals) >= 2:
                shap_vals_1d = raw_shap_vals[1][0]
            else:
                shap_vals_1d = raw_shap_vals[0][0]
            if hasattr(self.explainer, 'expected_value'):
                ev = self.explainer.expected_value
                base_val = float(ev[1] if isinstance(ev, (list, np.ndarray)) and len(ev) > 1 else ev)
        elif isinstance(raw_shap_vals, np.ndarray):
            if raw_shap_vals.ndim == 3 and raw_shap_vals.shape[2] == 2:
                # Shape (1, n_features, 2)
                shap_vals_1d = raw_shap_vals[0, :, 1]
                ev = getattr(self.explainer, 'expected_value', 0.0)
                base_val = float(ev[1] if isinstance(ev, (list, np.ndarray)) and len(ev) > 1 else ev)
            elif raw_shap_vals.ndim == 2:
                shap_vals_1d = raw_shap_vals[0]
                ev = getattr(self.explainer, 'expected_value', 0.0)
                base_val = float(ev[0] if isinstance(ev, (list, np.ndarray)) else ev)
            else:
                shap_vals_1d = raw_shap_vals.flatten()
        else:
            shap_vals_1d = np.zeros(len(transformed_feature_names))

        # Map transformed feature names back to domain features
        contributions = []
        for feat_name, shap_val in zip(transformed_feature_names, shap_vals_1d):
            clean_name = feat_name.replace("num__", "").replace("cat__", "")
            
            # Find original parent feature
            parent_col = None
            for orig in self.all_features:
                if clean_name.startswith(orig):
                    parent_col = orig
                    break
            
            parent_col = parent_col or clean_name
            obs_val = X_row[parent_col].values[0] if parent_col in X_row.columns else None

            val_float = round(float(shap_val), 4)
            if abs(val_float) < 0.0001:
                direction = "neutral"
            elif val_float > 0:
                direction = "positive"
            else:
                direction = "negative"

            # Formulate human interpretation
            display_title = FEATURE_DISPLAY_NAMES.get(parent_col, parent_col.replace("_", " ").title())
            if "crop_type" in clean_name:
                display_title = f"Crop Type ({clean_name.split('_')[-1]})"
            elif "season" in clean_name:
                display_title = f"Season ({clean_name.split('_')[-1]})"
            elif "state" in clean_name:
                display_title = f"State ({clean_name.split('_')[-1]})"

            if self.task_type == "classification":
                if direction == "positive":
                    interp = f"Observed value ({obs_val}) increased the model's likelihood of matching historical approved claims by +{abs(val_float):.3f}."
                elif direction == "negative":
                    interp = f"Observed value ({obs_val}) decreased the model's likelihood of matching historical approved claims by -{abs(val_float):.3f}."
                else:
                    interp = f"Feature had neutral or minimal impact on the model's prediction."
            else:
                if direction == "positive":
                    interp = f"Observed value ({obs_val}) increased estimated payout by +₹{abs(val_float):,.2f}."
                elif direction == "negative":
                    interp = f"Observed value ({obs_val}) reduced estimated payout by -₹{abs(val_float):,.2f}."
                else:
                    interp = f"Feature had neutral impact on estimated payout."

            contributions.append({
                "feature": clean_name,
                "feature_name_display": display_title,
                "observed_value": obs_val,
                "shap_value": val_float,
                "direction": direction,
                "interpretation": interp
            })

        # Sort by absolute impact
        contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        return {
            "base_value": round(float(base_val), 4),
            "shap_contributions": contributions
        }

    def explain_global(self, max_display: int = 10) -> List[Dict[str, Any]]:
        """
        Calculates global feature importance across background data using mean(|SHAP|).
        """
        if self.background_sample is None or len(self.background_sample) == 0:
            return []

        X_bg_trans = self.preprocessor.transform(self.background_sample)
        raw_shap_vals = self.explainer.shap_values(X_bg_trans)
        transformed_feature_names = self._get_feature_names_out()

        if isinstance(raw_shap_vals, list) and len(raw_shap_vals) >= 2:
            matrix = np.array(raw_shap_vals[1])
        elif isinstance(raw_shap_vals, np.ndarray) and raw_shap_vals.ndim == 3:
            matrix = raw_shap_vals[:, :, 1]
        elif isinstance(raw_shap_vals, np.ndarray) and raw_shap_vals.ndim == 2:
            matrix = raw_shap_vals
        else:
            return []

        mean_abs = np.mean(np.abs(matrix), axis=0)
        
        global_features = []
        for name, score in zip(transformed_feature_names, mean_abs):
            clean_name = name.replace("num__", "").replace("cat__", "")
            parent_col = next((orig for orig in self.all_features if clean_name.startswith(orig)), clean_name)
            display_title = FEATURE_DISPLAY_NAMES.get(parent_col, parent_col.replace("_", " ").title())
            
            global_features.append({
                "feature": clean_name,
                "name": display_title,
                "importance": round(float(score), 4)
            })

        global_features.sort(key=lambda x: x["importance"], reverse=True)
        return global_features[:max_display]

