import os
import sys
import json
import asyncio
import io
import functools

print = functools.partial(print, flush=True)

# Add workspace to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import ASGITransport, AsyncClient
from backend.app.main import 
async def run_all_checks():
    print("=" * 65)
    print("XAI-CropInsure: Pure In-Memory ASGI Endpoint Verification")
    print("=" * 65)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Health
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health failed: {res.status_code} {res.text}"
        health_data = res.json()
        print(f"[1/15] Health Check: {health_data['status']} | DB connected: {health_data['database_connected']} | Claims: {health_data['claims_registered']}")

        # 2. Dashboard Summary
        res = await client.get("/api/dashboard/summary")
        assert res.status_code == 200
        summary = res.json()
        print(f"[2/15] Dashboard Summary: Total Claims={summary['total_claims']} | Assessed={summary['claims_model_assessed']}")

        # 3. Dashboard Charts
        res = await client.get("/api/dashboard/charts")
        assert res.status_code == 200
        charts = res.json()
        print(f"[3/15] Dashboard Charts: Status categories={len(charts['status_distribution'])} | Crops={len(charts['crop_distribution'])}")

        # 4. Granular Dashboard: Claims by Status
        res = await client.get("/api/dashboard/claims-by-status")
        assert res.status_code == 200
        by_status = res.json()
        print(f"[4/15] Dashboard Claims By Status: {len(by_status)} categories")

        # 5. Granular Dashboard: Crop Analysis
        res = await client.get("/api/dashboard/crop-analysis")
        assert res.status_code == 200
        crop_an = res.json()
        print(f"[5/15] Dashboard Crop Analysis: {len(crop_an)} crop types analysed")

        # 6. Granular Dashboard: Region Analysis
        res = await client.get("/api/dashboard/region-analysis")
        assert res.status_code == 200
        reg_an = res.json()
        print(f"[6/15] Dashboard Region Analysis: {len(reg_an)} states analysed")

        # 7. Granular Dashboard: Model Performance
        res = await client.get("/api/dashboard/model-performance")
        assert res.status_code == 200
        mod_perf = res.json()
        print(f"[7/15] Dashboard Model Performance: Total models={mod_perf['total_models']}")

        # 8. Claims List
        res = await client.get("/api/claims?limit=5")
        assert res.status_code == 200
        claims_list = res.json()
        claims = claims_list["items"]
        print(f"[8/15] Claims List: Retrieved {len(claims)} of {claims_list['total']} claims")

        # 9. Create New Claim
        new_claim_payload = {
            "farmer_name": "Ramesh Patil",
            "policy_reference": "POL-MH-2026-999",
            "insurance_scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "state": "Maharashtra",
            "district": "Solapur",
            "village": "Kurduvadi",
            "crop_type": "Cotton",
            "season": "Kharif",
            "sowing_date": "2025-06-15",
            "claim_start_date": "2025-07-01",
            "claim_end_date": "2025-11-15",
            "cultivated_area": 3.0,
            "observed_rainfall": 290.0,
            "reference_rainfall": 820.0,
            "soil_moisture": 18.5,
            "observed_temperature": 36.0,
            "reference_temperature": 31.0,
            "current_ndvi": 0.32,
            "reference_ndvi": 0.66
        }
        res = await client.post("/api/claims", json=new_claim_payload)
        assert res.status_code == 201
        created_claim = res.json()
        claim_id = created_claim["id"]
        print(f"[9/15] Claim Created: ID={claim_id} | Ref={created_claim['claim_reference']} | Farmer={created_claim['farmer_name']}")

        # 10. Run Assessment with genuine ML & SHAP
        res = await client.post(f"/api/claims/{claim_id}/assess", json={})
        assert res.status_code == 200
        assessment = res.json()
        assert assessment["prediction_label"] in ["Approved", "Rejected"]
        assert len(assessment["shap_contributions"]) > 0
        print(f"[10/15] ML Assessment & SHAP: Prediction='{assessment['prediction_label']}' | Probability={assessment['prediction_probability']}")
        print(f"       Farmer Explanation: {assessment['farmer_friendly_summary'][:70]}...")

        # 11. Human Review (Decision Support)
        review_payload = {
            "reviewer_name": "District Officer Sharma",
            "reviewer_role": "Agricultural Officer",
            "review_decision": "Approved",
            "differs_from_model": False,
            "rationale": "Field crop-cutting experiment corroborates severe drought loss in Solapur tehsil."
        }
        res = await client.post(f"/api/claims/{claim_id}/review", json=review_payload)
        assert res.status_code == 200
        rev = res.json()
        print(f"[11/15] Human Review: Decision='{rev['review_decision']}' by {rev['reviewer_name']}")

        # 12. Audit Trail
        res = await client.get(f"/api/claims/{claim_id}/audit")
        assert res.status_code == 200
        audit_events = res.json()
        assert len(audit_events) >= 3
        print(f"[12/15] Audit Trail: {len(audit_events)} audit events logged for claim {claim_id}")

        # 13. PDF Report Generation
        res = await client.get(f"/api/claims/{claim_id}/report")
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert len(res.content) > 1000
        print(f"[13/15] PDF Report: Generated successfully ({len(res.content)} bytes)")

        # 14. Datasets Preview
        res = await client.get("/api/datasets")
        assert res.status_code == 200
        datasets = res.json()
        if datasets:
            ds_id = datasets[0]["id"]
            res = await client.get(f"/api/datasets/{ds_id}/preview")
            assert res.status_code == 200
            preview = res.json()
            print(f"[14/15] Dataset Preview: '{preview['name']}' has {preview['total_rows']} rows, {preview['total_columns']} columns")

        # 15. Models & Global SHAP Explainability
        res = await client.get("/api/models")
        assert res.status_code == 200
        models = res.json()
        if models:
            m_id = models[0]["id"]
            res = await client.get(f"/api/models/{m_id}/explainability/global")
            assert res.status_code == 200
            global_exp = res.json()
            features = global_exp["feature_importance"]
            print(f"[15/15] Global SHAP: Model {m_id} has {len(features)} ranked features. Top feature: {features[0]['name']}")

    print("=" * 65)
    print("ALL 15 ENDPOINTS VERIFIED AND WORKING PERFECTLY!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_all_checks())
