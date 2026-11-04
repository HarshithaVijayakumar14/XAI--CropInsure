import joblib
import os
import sys
import numpy as np
import pandas as pd
import shap

model_path = r"c:\Users\harsh\OneDrive\Desktop\XAI\data\models\model_agricultural_yield_v1.ceb9c0.joblib"
print(f"Loading {model_path}...")
bundle = joblib.load(model_path)
pipeline = bundle["pipeline"]
pre = pipeline.named_steps["preprocessor"]
est = pipeline.named_steps["estimator"]

test_input = {
    "State": "Karnataka",
    "District": "Dharwad",
    "Crop": "Rice",
    "Season": "Kharif",
    "Area": 2.5
}
df = pd.DataFrame([test_input])
pred_yield = float(pipeline.predict(df)[0])
print(f"Predicted yield: {pred_yield:.3f} Tonnes/Ha")

# SHAP TreeExplainer
explainer = shap.TreeExplainer(est)
df_trans = pre.transform(df).toarray()
shap_vals = explainer.shap_values(df_trans)[0]

base_val = explainer.expected_value
if isinstance(base_val, (np.ndarray, list)):
    base_val = float(base_val[0])
else:
    base_val = float(base_val)

print(f"Base value: {base_val:.3f}")
feature_names = pre.get_feature_names_out()

# Group contributions by original feature
grouped = {"State": 0.0, "District": 0.0, "Crop": 0.0, "Season": 0.0, "Area": 0.0}
for name, val in zip(feature_names, shap_vals):
    if name.startswith("cat__State"):
        grouped["State"] += float(val)
    elif name.startswith("cat__District"):
        grouped["District"] += float(val)
    elif name.startswith("cat__Crop"):
        grouped["Crop"] += float(val)
    elif name.startswith("cat__Season"):
        grouped["Season"] += float(val)
    elif name.startswith("num__Area"):
        grouped["Area"] += float(val)

print("Grouped SHAP contributions:")
for k, v in grouped.items():
    print(f"  {k} ({test_input[k]}): {v:+.4f} T/Ha")

calc_sum = base_val + sum(grouped.values())
print(f"Base + Sum(SHAP) = {calc_sum:.3f} (matches pred {pred_yield:.3f}: {np.isclose(calc_sum, pred_yield)})")

# Test unknown category
df_unknown = pd.DataFrame([{"State": "UnknownState", "District": "UnknownDistrict", "Crop": "UnknownCrop", "Season": "UnknownSeason", "Area": 5.0}])
pred_unknown = float(pipeline.predict(df_unknown)[0])
print(f"Unknown category yield prediction: {pred_unknown:.3f} Tonnes/Ha")

# Inspect encoder categories
ohe = pre.named_transformers_["cat"]
print("State categories:", len(ohe.categories_[0]), ohe.categories_[0][:5])
print("District categories:", len(ohe.categories_[1]), ohe.categories_[1][:5])
print("Crop categories:", len(ohe.categories_[2]), ohe.categories_[2][:10])
print("Season categories:", len(ohe.categories_[3]), ohe.categories_[3])
