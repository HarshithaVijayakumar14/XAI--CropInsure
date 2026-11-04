import urllib.request
import json

print("=== 1. Testing GET /api/models/agricultural-yield/options ===")
req_opt = urllib.request.Request("http://127.0.0.1:8000/api/models/agricultural-yield/options")
with urllib.request.urlopen(req_opt) as res:
    data = json.loads(res.read())
    print("Options HTTP Status:", res.status)
    print("States count:", len(data["states"]))
    print("Crops count:", len(data["crops"]))
    print("Seasons:", data["seasons"])
    print("Model ID:", data["model_metadata"]["model_id"])
    print("Model Name:", data["model_metadata"]["model_name"])
    print("Model is_active (must be False):", data["model_metadata"]["is_active"])
    print("R2 Score:", data["model_metadata"]["r2_score"])
    print("MAE:", data["model_metadata"]["mae"])
    print("RMSE:", data["model_metadata"]["rmse"])

print("\n=== 2. Testing POST /api/models/agricultural-yield/predict (Rice in Karnataka) ===")
payload1 = {
    "state": "Karnataka",
    "district": "Dharwad",
    "crop": "Rice",
    "season": "Kharif",
    "area": 2.5
}
req1 = urllib.request.Request(
    "http://127.0.0.1:8000/api/models/agricultural-yield/predict",
    data=json.dumps(payload1).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req1) as res1:
        res_data1 = json.loads(res1.read())
        print("Predict HTTP Status:", res1.status)
        print(f"Predicted Yield: {res_data1['predicted_yield_tonnes_per_ha']} {res_data1['unit_yield']}")
        print(f"Total Production: {res_data1['predicted_total_production_tonnes']} {res_data1['unit_production']}")
        print(f"Baseline Mean Yield: {res_data1['baseline_mean_yield']} T/Ha")
        print(f"Difference from Baseline: {res_data1['difference_from_baseline']:+.3f} T/Ha")
        print("SHAP Summary:", res_data1["shap_explanation"]["plain_text_summary"])
        print("SHAP Feature Contributions:")
        for c in res_data1["shap_explanation"]["feature_contributions"]:
            print(f"  * {c['feature']} ({c['input_value']}): {c['shap_value']:+.4f} T/Ha -> {c['impact_description']}")
        print("Disclaimer:", res_data1["disclaimer"])
        print("Warnings:", res_data1["warnings"])
except urllib.error.HTTPError as e:
    print("HTTP Error 422 Details:", e.read().decode('utf-8'))


print("\n=== 3. Testing POST /api/models/agricultural-yield/predict (Wheat in Punjab) ===")
payload2 = {
    "state": "Punjab",
    "district": "Ludhiana",
    "crop": "Wheat",
    "season": "Rabi",
    "area": 4.0
}
req2 = urllib.request.Request(
    "http://127.0.0.1:8000/api/models/agricultural-yield/predict",
    data=json.dumps(payload2).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req2) as res2:
    res_data2 = json.loads(res2.read())
    print("Predict HTTP Status:", res2.status)
    print(f"Predicted Yield: {res_data2['predicted_yield_tonnes_per_ha']} {res_data2['unit_yield']}")
    print(f"Total Production: {res_data2['predicted_total_production_tonnes']} {res_data2['unit_production']}")
    print("SHAP Summary:", res_data2["shap_explanation"]["plain_text_summary"])
    for c in res_data2["shap_explanation"]["feature_contributions"]:
        print(f"  * {c['feature']} ({c['input_value']}): {c['shap_value']:+.4f} T/Ha")

print("\n=== 4. Testing Input Validation & Safe Fallback (Unknown Novel Input) ===")
payload3 = {
    "state": "Atlantis",
    "district": "DeepSea",
    "crop": "Kelp",
    "season": "Whole Year",
    "area": 1.5
}
req3 = urllib.request.Request(
    "http://127.0.0.1:8000/api/models/agricultural-yield/predict",
    data=json.dumps(payload3).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req3) as res3:
    res_data3 = json.loads(res3.read())
    print("Predict HTTP Status (Handled Safely):", res3.status)
    print(f"Fallback Yield: {res_data3['predicted_yield_tonnes_per_ha']} {res_data3['unit_yield']}")
    print("Warnings Returned:", res_data3["warnings"])
