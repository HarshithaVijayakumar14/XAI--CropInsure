import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000/api"

def run_tests():
    print("=================================================================")
    print("XAI-CropInsure: Agricultural Yield Prediction Verification Suite")
    print("=================================================================")

    # 1. Health check
    print("\n[Test 1] Health Check...")
    with urllib.request.urlopen(f"{BASE_URL}/health") as res:
        health = json.loads(res.read())
        assert health["status"] == "healthy"
        print(f"  Passed! Status: {health['status']}, Models Trained: {health['models_trained']}")

    # 2. Model Registry Status
    print("\n[Test 2] Verifying Model Isolation (Model 1 Active, Model 2 Inactive)...")
    with urllib.request.urlopen(f"{BASE_URL}/models") as res:
        models = json.loads(res.read())
        m1 = next((m for m in models if m["id"] == 1), None)
        m2 = next((m for m in models if m["id"] == 2), None)
        assert m1 and m1["is_active"] is True, "Model 1 must remain active!"
        assert m2 and m2["is_active"] is False, "Model 2 must remain inactive!"
        print(f"  Passed! Model 1 (Insurance): active={m1['is_active']}, Model 2 (Agri Yield): active={m2['is_active']}")

    # 3. Agricultural Options Endpoint
    print("\n[Test 3] Options & Metadata Endpoint (GET /models/agricultural-yield/options)...")
    with urllib.request.urlopen(f"{BASE_URL}/models/agricultural-yield/options") as res:
        opts = json.loads(res.read())
        assert len(opts["states"]) > 30
        assert len(opts["crops"]) > 50
        assert opts["model_metadata"]["is_active"] is False
        print(f"  Passed! States: {len(opts['states'])}, Crops: {len(opts['crops'])}, Seasons: {opts['seasons']}")
        print(f"  Model R2 Score: {opts['model_metadata']['r2_score']}, MAE: {opts['model_metadata']['mae']} T/Ha")

    # 4. Standard Prediction (Karnataka Rice, 2.5 Ha)
    print("\n[Test 4] Prediction & SHAP (Rice in Karnataka, 2.5 Ha)...")
    payload1 = {
        "state": "Karnataka",
        "district": "Dharwad",
        "crop": "Rice",
        "season": "Kharif",
        "area": 2.5
    }
    req1 = urllib.request.Request(
        f"{BASE_URL}/models/agricultural-yield/predict",
        data=json.dumps(payload1).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req1) as res:
        p1 = json.loads(res.read())
        assert p1["predicted_yield_tonnes_per_ha"] > 0
        assert p1["predicted_total_production_tonnes"] > 0
        assert len(p1["shap_explanation"]["feature_contributions"]) == 5
        print(f"  Passed! Predicted Yield: {p1['predicted_yield_tonnes_per_ha']} {p1['unit_yield']}")
        print(f"  Total Production: {p1['predicted_total_production_tonnes']} {p1['unit_production']}")
        print(f"  Baseline: {p1['baseline_mean_yield']} T/Ha, Variance: {p1['difference_from_baseline']:+.3f} T/Ha")
        print(f"  SHAP Explanation: {p1['shap_explanation']['plain_text_summary']}")

    # 5. Unknown Category Resilience
    print("\n[Test 5] Unknown Category Resilience (Atlantis, DeepSea, Kelp)...")
    payload_unknown = {
        "state": "Atlantis",
        "district": "DeepSea",
        "crop": "Kelp",
        "season": "Whole Year",
        "area": 1.0
    }
    req_un = urllib.request.Request(
        f"{BASE_URL}/models/agricultural-yield/predict",
        data=json.dumps(payload_unknown).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_un) as res:
        p_un = json.loads(res.read())
        assert p_un["predicted_yield_tonnes_per_ha"] > 0
        assert len(p_un["warnings"]) == 3
        print(f"  Passed! Safely predicted: {p_un['predicted_yield_tonnes_per_ha']} T/Ha without crash.")
        print(f"  Warnings generated: {p_un['warnings']}")

    # 6. Input Validation (Area <= 0)
    print("\n[Test 6] Input Validation for invalid area (Area = -2.0 Ha)...")
    payload_invalid = {
        "state": "Karnataka",
        "district": "Dharwad",
        "crop": "Rice",
        "season": "Kharif",
        "area": -2.0
    }
    req_inv = urllib.request.Request(
        f"{BASE_URL}/models/agricultural-yield/predict",
        data=json.dumps(payload_invalid).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req_inv)
        assert False, "Should have thrown 422 error"
    except urllib.error.HTTPError as e:
        assert e.code == 422
        print(f"  Passed! Threw expected HTTP 422 Unprocessable Entity for negative area.")

    # 7. Unaffected Claim Assessment
    print("\n[Test 7] Verifying Existing Claim Assessment Pipeline is Unaffected...")
    with urllib.request.urlopen(f"{BASE_URL}/claims?limit=1") as res:
        claims = json.loads(res.read())["items"]
        if claims:
            cid = claims[0]["id"]
            req_assess = urllib.request.Request(
                f"{BASE_URL}/claims/{cid}/assess",
                data=json.dumps({}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req_assess) as res_a:
                assess = json.loads(res_a.read())
                assert assess["prediction_label"] in ["Approved", "Rejected"]
                print(f"  Passed! Claim {claims[0]['claim_reference']} assessed by Model {assess['model_id']}: {assess['prediction_label']} ({assess.get('prediction_probability', 0)*100:.1f}%)")

    print("\n=================================================================")
    print("ALL 7 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()

