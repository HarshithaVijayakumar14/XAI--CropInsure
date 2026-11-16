import urllib.request
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def post_json(path, data):
    url = f"{BASE_URL}{path}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        print(f"HTTP Error {err.code} on {path}: {err_body}")
        raise

def get_json(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def run_tests():
    print("=== STARTING END-TO-END WORKFLOW VERIFICATION ===")

    # 1. SCENARIO 1: Farmer checks crop yield & eligibility predictor
    print("\n--- Testing Scenario 1: Agricultural Yield & Insurance Eligibility Prediction ---")
    pred_payload = {
        "state": "Karnataka",
        "district": "Dharwad",
        "crop": "Rice",
        "season": "Kharif",
        "area": 2.5
    }
    yield_res = post_json("/api/models/agricultural-yield/predict", pred_payload)
    print(f"Predicted Yield: {yield_res['predicted_yield_tonnes_per_ha']} T/Ha (~{yield_res.get('predicted_yield_quintals_per_acre')} Quintals/Acre)")
    print(f"Predicted Total: {yield_res['predicted_total_production_tonnes']} Tonnes (~{yield_res.get('predicted_total_quintals')} Quintals)")
    print(f"Historical Median: {yield_res['crop_historical_median_yield']} T/Ha | Shortfall Threshold: {yield_res['crop_yield_threshold']} T/Ha")
    print(f"Predicted Insurance Eligibility: {yield_res.get('predicted_insurance_eligibility')}")
    print(f"Reasons supporting: {yield_res.get('reasons_supporting_claim')}")
    print(f"Reasons against: {yield_res.get('reasons_against_claim')}")
    print(f"Neutral factors: {yield_res.get('neutral_factors')}")
    assert yield_res.get('predicted_insurance_eligibility') in [
        "Likely Eligible for Insurance Claim",
        "Likely Not Eligible for Insurance Claim",
        "Insufficient Information to Predict"
    ], f"Invalid eligibility: {yield_res.get('predicted_insurance_eligibility')}"

    # 2. SCENARIO 2: Farmer submits claim (with pre-filled predictor details)
    print("\n--- Testing Scenario 2: Farmer Claim Registration with Automatic AI Assessment ---")
    claim_payload = {
        "farmer_name": "Ramesh Patil",
        "contact_number": "9876543210",
        "policy_reference": "PMFBY-2025-KT-DH-0099",
        "insurance_scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "sum_insured": 75000,
        "state": "Karnataka",
        "district": "Dharwad",
        "village": "Navalgund",
        "crop_type": "Rice/Paddy",
        "season": "Kharif",
        "sowing_date": "2025-06-15",
        "claim_start_date": "2025-07-20",
        "claim_end_date": "2025-11-05",
        "reported_loss_pct": 65,
        "loss_description": "Severe deficit monsoon rainfall leading to tillering stage moisture stress and vegetative stunting.",
        "cultivated_area": 2.5,
        "observed_rainfall": 280,
        "reference_rainfall": 820,
        "observed_temperature": 33.5,
        "reference_temperature": 29.5,
        "current_ndvi": 0.28,
        "reference_ndvi": 0.58
    }
    claim_res = post_json("/api/claims", claim_payload)
    claim_id = claim_res["id"]
    claim_ref = claim_res["claim_reference"]
    print(f"Created Claim: ID={claim_id}, Ref={claim_ref}, Status={claim_res['status']}")
    print(f"Workflow Stage: {claim_res.get('workflow_stage')}")
    ai_assess = claim_res.get("ai_assessment") or {}
    print(f"AI Predicted Eligibility: {ai_assess.get('predicted_eligibility')}")
    print(f"AI Confidence: {ai_assess.get('confidence_percentage')}%")
    print(f"Supporting reasons count: {len(ai_assess.get('reasons_supporting', []))}")
    print(f"Opposing reasons count: {len(ai_assess.get('reasons_against', []))}")
    assert ai_assess.get("predicted_eligibility") is not None

    # 3. SCENARIO 3: Farmer views claim in My Claims
    print("\n--- Testing Scenario 3: My Claims Inspection (5-Stage Tracker & Sections A, B, C) ---")
    inspect_res = get_json(f"/api/claims/{claim_id}")
    timeline = inspect_res.get("timeline_stages", [])
    print(f"Timeline stages count: {len(timeline)}")
    for stg in timeline:
        print(f"  Stage {stg['stage_number']}: {stg['title']} -> {stg['status']} ({stg.get('date')})")
    assert len(timeline) == 5, f"Expected 5 timeline stages, got {len(timeline)}"

    officer_dec = inspect_res.get("officer_decision") or {}
    print(f"Officer Decision Before Review: is_decided={officer_dec.get('is_decided')}, decision={officer_dec.get('decision')}")
    assert officer_dec.get("is_decided") is False
    assert officer_dec.get("decision") == "Awaiting Officer Decision"

    comp = inspect_res.get("comparison") or {}
    print(f"Comparison: AI={comp.get('ai_predicted_eligibility')} vs Officer={comp.get('officer_final_decision')}")
    print(f"Agreement Status: {comp.get('agreement_status')}")

    # 4. SCENARIO 4: Officer reviews claim and Approves with Field Survey Verification
    print("\n--- Testing Scenario 4: Officer Review & Approval (Recording Verified Loss & Yield) ---")
    review_payload = {
        "reviewer_name": "Dr. Anita Deshmukh",
        "reviewer_role": "District Agricultural Officer",
        "review_decision": "Approved",
        "differs_from_model": False,
        "rationale": "Field inspection and panchayat CCE data verified 62% yield deficit due to tillering drought stress.",
        "verified_crop_loss": 62.0,
        "verified_crop_yield": 1.15
    }
    rev_res = post_json(f"/api/claims/{claim_id}/review", review_payload)
    print(f"Review recorded: ID={rev_res['id']}, Decision={rev_res['review_decision']}")

    # Verify claim status updated immediately and synchronized with farmer view
    updated_claim = get_json(f"/api/claims/{claim_id}")
    print(f"Updated Claim Status: {updated_claim['status']}")
    print(f"Updated Workflow Stage: {updated_claim.get('workflow_stage')}")
    print(f"Officer Decision: {updated_claim.get('officer_decision', {}).get('decision')}")
    print(f"Verified Loss: {updated_claim.get('officer_decision', {}).get('verified_crop_loss_display')}")
    print(f"Verified Yield: {updated_claim.get('officer_decision', {}).get('verified_crop_yield_display')}")
    print(f"Comparison Insight: {updated_claim.get('comparison', {}).get('comparison_insight')}")
    assert updated_claim["status"] == "Approved"
    assert updated_claim.get("officer_decision", {}).get("is_decided") is True

    # 5. SCENARIO 5: Manual Override Case (Officer Decision Differs from Model)
    print("\n--- Testing Scenario 5: Manual Override (AI predicted one thing, Officer overrides with reason) ---")
    marginal_claim_payload = {
        "farmer_name": "Suresh Gowda",
        "contact_number": "9123456789",
        "policy_reference": "PMFBY-2025-KT-DH-0100",
        "insurance_scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "sum_insured": 50000,
        "state": "Karnataka",
        "district": "Dharwad",
        "village": "Hubballi Rural",
        "crop_type": "Wheat",
        "season": "Rabi",
        "sowing_date": "2025-10-10",
        "claim_start_date": "2025-12-01",
        "claim_end_date": "2026-03-01",
        "reported_loss_pct": 20,
        "loss_description": "Minor pest issue on late sown wheat.",
        "cultivated_area": 1.5,
        "observed_rainfall": 520,
        "reference_rainfall": 550,
        "observed_temperature": 26.0,
        "reference_temperature": 25.5,
        "current_ndvi": 0.65,
        "reference_ndvi": 0.68
    }
    marginal_res = post_json("/api/claims", marginal_claim_payload)
    claim2_id = marginal_res["id"]

    override_review_payload = {
        "reviewer_name": "Senior Assessor R. K. Verma",
        "reviewer_role": "Claim Assessor",
        "review_decision": "Rejected",
        "differs_from_model": True,
        "rationale": "Yield loss within normal threshold (under 30%). Satellite NDVI and weather data show normal crop health.",
        "verified_crop_loss": 12.0,
        "verified_crop_yield": 3.8
    }
    post_json(f"/api/claims/{claim2_id}/review", override_review_payload)
    claim2_updated = get_json(f"/api/claims/{claim2_id}")
    print(f"Claim 2 Status: {claim2_updated['status']}")
    print(f"Claim 2 Differs from Model: {claim2_updated.get('officer_decision', {}).get('differs_from_model')}")
    print(f"Claim 2 Comparison Agreement: {claim2_updated.get('comparison', {}).get('agreement_status')}")
    print(f"Claim 2 Comparison Insight: {claim2_updated.get('comparison', {}).get('comparison_insight')}")
    assert claim2_updated["status"] == "Rejected"

    # 6. SCENARIO 6: Officer requests Additional Verification
    print("\n--- Testing Scenario 6: Officer Requests Additional Verification ---")
    claim3_payload = {
        "farmer_name": "Pooja Hegde",
        "contact_number": "9988776655",
        "policy_reference": "PMFBY-2025-KT-DH-0101",
        "insurance_scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
        "sum_insured": 60000,
        "state": "Karnataka",
        "district": "Dharwad",
        "village": "Alnavar",
        "crop_type": "Cotton",
        "season": "Kharif",
        "sowing_date": "2025-06-25",
        "claim_start_date": "2025-08-15",
        "claim_end_date": "2025-11-20",
        "reported_loss_pct": 55,
        "loss_description": "Bollworm infestation reported in patch of farm.",
        "cultivated_area": 2.0,
        "observed_rainfall": 600,
        "reference_rainfall": 650,
        "observed_temperature": 28.0,
        "reference_temperature": 27.5,
        "current_ndvi": 0.45,
        "reference_ndvi": 0.52
    }
    claim3_res = post_json("/api/claims", claim3_payload)
    claim3_id = claim3_res["id"]

    verification_review = {
        "reviewer_name": "Field Assessor M. S. Rao",
        "reviewer_role": "Agricultural Officer",
        "review_decision": "Additional Evidence Required",
        "differs_from_model": False,
        "rationale": "Requires joint inspection report with village patwari and block entomologist to quantify pest damage percentage.",
        "required_evidence": "Joint field inspection report and village patwari loss certification"
    }
    post_json(f"/api/claims/{claim3_id}/review", verification_review)
    claim3_updated = get_json(f"/api/claims/{claim3_id}")
    print(f"Claim 3 Status: {claim3_updated['status']}")
    print(f"Claim 3 Workflow Stage: {claim3_updated.get('workflow_stage')}")
    print(f"Claim 3 Required Evidence: {claim3_updated.get('officer_decision', {}).get('required_evidence')}")
    assert claim3_updated["status"] == "Additional evidence required"
    assert claim3_updated.get("workflow_stage") == "Verification in Progress"

    print("\n=== ALL 6 END-TO-END SCENARIOS VERIFIED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_tests()
