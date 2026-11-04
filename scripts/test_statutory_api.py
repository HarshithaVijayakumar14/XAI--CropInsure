import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000/api"

print("--- 1. Testing GET /api/claims/1/statutory-rules ---")
req = urllib.request.Request(f"{BASE_URL}/claims/1/statutory-rules")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read())
    print("Status code:", res.status)
    print("Loss Category:", data["loss_category"])
    print("Peril:", data["reported_peril"])
    print("Peril Consistent:", data["is_peril_consistent"])
    print("Preliminary Triage:", data["preliminary_triage"])
    print("Checks Count:", len(data["checks"]))
    for c in data["checks"]:
        print(f"  * {c['title']}: [{c['status']}] {c['details'][:70]}...")
    print("Evidence Checklist Count:", len(data["evidence_checklist"]))

print("\n--- 2. Testing POST /api/claims/1/assess with Statutory Rules Attached ---")
req_assess = urllib.request.Request(
    f"{BASE_URL}/claims/1/assess",
    data=json.dumps({}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req_assess) as res_a:
    assess = json.loads(res_a.read())
    print("Assess Status code:", res_a.status)
    print("ML Prediction Label:", assess["prediction_label"])
    print("ML Probability (Uncalibrated):", assess["prediction_probability"])
    print("Statutory Rules Attached:", assess.get("statutory_rules") is not None)
    if assess.get("statutory_rules"):
        sr = assess["statutory_rules"]
        print("  Category:", sr["loss_category"])
        print("  Triage:", sr["preliminary_triage"])
        print("  Disclaimer:", sr["disclaimer"][:60], "...")

