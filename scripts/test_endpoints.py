import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

print("--- Testing GET /api/models/agricultural-yield/options ---")
res_opts = client.get("/api/models/agricultural-yield/options")
print("Status code:", res_opts.status_code)
if res_opts.status_code == 200:
    data = res_opts.json()
    print("States count:", len(data["states"]))
    print("Crops count:", len(data["crops"]))
    print("Seasons:", data["seasons"])
    print("Model info:", data["model_metadata"])
else:
    print("Error:", res_opts.text)

print("\n--- Testing POST /api/models/agricultural-yield/predict ---")
payload = {
    "state": "Karnataka",
    "district": "Dharwad",
    "crop": "Rice",
    "season": "Kharif",
    "area": 2.5
}
res_pred = client.post("/api/models/agricultural-yield/predict", json=payload)
print("Status code:", res_pred.status_code)
if res_pred.status_code == 200:
    res_data = res_pred.json()
    print("Predicted Yield:", res_data["predicted_yield_tonnes_per_ha"], res_data["unit_yield"])
    print("Total Production:", res_data["predicted_total_production_tonnes"], res_data["unit_production"])
    print("Baseline:", res_data["baseline_mean_yield"])
    print("Plain text summary:", res_data["shap_explanation"]["plain_text_summary"])
    print("Contributions count:", len(res_data["shap_explanation"]["feature_contributions"]))
    for c in res_data["shap_explanation"]["feature_contributions"]:
        print(f"  {c['feature']} ({c['input_value']}): {c['shap_value']:+.4f} -> {c['impact_description']}")
    print("Disclaimer:", res_data["disclaimer"][:60], "...")
    print("Warnings:", res_data["warnings"])
else:
    print("Error:", res_pred.text)

print("\n--- Testing Unknown Category / Resilience ---")
payload_unknown = {
    "state": "Mars",
    "district": "Olympus",
    "crop": "CosmicGrain",
    "season": "Summer",
    "area": 1.0
}
res_un = client.post("/api/models/agricultural-yield/predict", json=payload_unknown)
print("Status code:", res_un.status_code)
if res_un.status_code == 200:
    print("Unknown handled safely. Yield:", res_un.json()["predicted_yield_tonnes_per_ha"])
    print("Warnings generated:", res_un.json()["warnings"])
else:
    print("Error:", res_un.text)
