import os
import sys
from datetime import datetime, timezone, timedelta

# Ensure backend is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.pmfby_rules_service import PMFBYRuleAssessmentService

def run_tests():
    print("=================================================================")
    print("PMFBY Statutory Rules Assessment: Comprehensive Verification")
    print("=================================================================")

    now = datetime.now(timezone.utc)

    # -------------------------------------------------------------
    # Scenario 1: Localized calamity reported WITHIN 72h deadline
    # -------------------------------------------------------------
    print("\n[Scenario 1] Localized calamity reported WITHIN 72h deadline (Hailstorm in Sirsa, Haryana)...")
    claim_1 = {
        "claim_reference": "TEST-LOC-01",
        "state": "Haryana",
        "district": "Sirsa",
        "crop_type": "Wheat",
        "season": "Rabi",
        "cultivated_area": 2.0,
        "loss_description": "Severe hailstorm event with heavy ice stones causing lodging and complete canopy damage.",
        "growth_stage": "Flowering / Tasseling",
        "loss_date": (now - timedelta(hours=24)).strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
        "observed_rainfall": 45.0,
        "reference_rainfall": 20.0
    }
    res_1 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_1)
    assert res_1["loss_category"] == "Localized Calamity", f"Expected Localized Calamity, got {res_1['loss_category']}"
    assert res_1["is_peril_consistent"] is True
    dl_check_1 = next(c for c in res_1["checks"] if c["check_id"] == "notification_deadline")
    assert dl_check_1["status"] == "Passed", f"Expected Passed for 24h notification, got {dl_check_1['status']}"
    print(f"  Category: {res_1['loss_category']} ({res_1['reported_peril']})")
    print(f"  72h Deadline Check: {dl_check_1['status']} ({dl_check_1['details']})")
    print(f"  Triage: {res_1['preliminary_triage']}")

    # -------------------------------------------------------------
    # Scenario 2: Localized calamity reported AFTER 72h deadline (>72h)
    # -------------------------------------------------------------
    print("\n[Scenario 2] Localized calamity reported AFTER 72h deadline (Inundation 5 days ago)...")
    claim_2 = {
        "claim_reference": "TEST-LOC-02",
        "state": "Madhya Pradesh",
        "district": "Vidisha",
        "crop_type": "Soybean",
        "season": "Kharif",
        "cultivated_area": 1.5,
        "loss_description": "Field inundation and submergence due to river overflow causing root rotting.",
        "growth_stage": "Vegetative Growth",
        "loss_date": (now - timedelta(days=5)).strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
        "observed_rainfall": 120.0,
        "reference_rainfall": 80.0
    }
    res_2 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_2)
    assert res_2["loss_category"] == "Localized Calamity"
    dl_check_2 = next(c for c in res_2["checks"] if c["check_id"] == "notification_deadline")
    assert dl_check_2["status"] == "Failed", f"Expected Failed for 120h notification, got {dl_check_2['status']}"
    assert "Statutory Review Flagged" in res_2["preliminary_triage"]
    print(f"  Category: {res_2['loss_category']} ({res_2['reported_peril']})")
    print(f"  72h Deadline Check: {dl_check_2['status']} ({dl_check_2['details']})")
    print(f"  Triage: {res_2['preliminary_triage']}")

    # -------------------------------------------------------------
    # Scenario 3: Drought-related claim (72h rule must NOT apply!)
    # -------------------------------------------------------------
    print("\n[Scenario 3] Drought / Moisture Stress claim (Mid-Season Adversity)...")
    claim_3 = {
        "claim_reference": "TEST-DROUGHT-03",
        "state": "Karnataka",
        "district": "Dharwad",
        "crop_type": "Maize",
        "season": "Kharif",
        "cultivated_area": 3.0,
        "loss_description": "Severe prolonged dry spell and rainfall deficit during vegetative phase causing withering.",
        "growth_stage": "Vegetative Growth",
        "loss_date": (now - timedelta(days=25)).strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
        "observed_rainfall": 150.0,
        "reference_rainfall": 600.0,
        "current_ndvi": 0.35,
        "reference_ndvi": 0.65
    }
    res_3 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_3)
    assert res_3["loss_category"] == "Mid-Season Adversity", f"Expected Mid-Season Adversity, got {res_3['loss_category']}"
    dl_check_3 = next(c for c in res_3["checks"] if c["check_id"] == "notification_deadline")
    assert dl_check_3["status"] == "Not Applicable", f"Expected Not Applicable for drought 72h rule, got {dl_check_3['status']}"
    print(f"  Category: {res_3['loss_category']} ({res_3['reported_peril']})")
    print(f"  72h Deadline Check: {dl_check_3['status']} ({dl_check_3['details']})")
    print(f"  Triage: {res_3['preliminary_triage']}")

    # -------------------------------------------------------------
    # Scenario 4: Post-Harvest claim within verified 14-day drying window
    # -------------------------------------------------------------
    print("\n[Scenario 4] Post-Harvest claim WITHIN 14-day drying window...")
    claim_4 = {
        "claim_reference": "TEST-POSTHARV-04",
        "state": "Punjab",
        "district": "Ludhiana",
        "crop_type": "Wheat",
        "season": "Rabi",
        "cultivated_area": 2.5,
        "loss_description": "Unseasonal cyclonic rains on harvested crops drying in cut and spread condition in the field.",
        "growth_stage": "Maturity",
        "harvest_date": (now - timedelta(days=6)).strftime("%Y-%m-%d"),
        "loss_date": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
        "observed_rainfall": 65.0,
        "reference_rainfall": 15.0
    }
    res_4 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_4)
    assert res_4["loss_category"] == "Post-Harvest Loss", f"Expected Post-Harvest Loss, got {res_4['loss_category']}"
    assert res_4["is_peril_consistent"] is True
    hw_check_4 = next(c for c in res_4["checks"] if c["check_id"] == "harvest_drying_window")
    dl_check_4 = next(c for c in res_4["checks"] if c["check_id"] == "notification_deadline")
    assert hw_check_4["status"] == "Passed", f"Expected Passed for 4 days post-harvest, got {hw_check_4['status']}"
    assert dl_check_4["status"] == "Passed", f"Expected Passed for 48h notice, got {dl_check_4['status']}"
    print(f"  Category: {res_4['loss_category']} ({res_4['reported_peril']})")
    print(f"  Drying Window Check: {hw_check_4['status']} ({hw_check_4['details']})")
    print(f"  72h Notice Check: {dl_check_4['status']} ({dl_check_4['details']})")

    # -------------------------------------------------------------
    # Scenario 5: Post-Harvest claim OUTSIDE 14-day drying window (>14 days)
    # -------------------------------------------------------------
    print("\n[Scenario 5] Post-Harvest claim OUTSIDE 14-day window (22 days post-harvest)...")
    claim_5 = {
        "claim_reference": "TEST-POSTHARV-05",
        "state": "Punjab",
        "district": "Ludhiana",
        "crop_type": "Wheat",
        "season": "Rabi",
        "cultivated_area": 2.5,
        "loss_description": "Heavy untimely rains soaked harvested wheat lying in cut & spread condition.",
        "growth_stage": "Maturity",
        "harvest_date": (now - timedelta(days=25)).strftime("%Y-%m-%d"),
        "loss_date": (now - timedelta(days=3)).strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
        "observed_rainfall": 50.0,
        "reference_rainfall": 10.0
    }
    res_5 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_5)
    hw_check_5 = next(c for c in res_5["checks"] if c["check_id"] == "harvest_drying_window")
    assert hw_check_5["status"] == "Failed", f"Expected Failed for 22 days post-harvest, got {hw_check_5['status']}"
    assert "Statutory Review Flagged" in res_5["preliminary_triage"]
    print(f"  Category: {res_5['loss_category']}")
    print(f"  Drying Window Check: {hw_check_5['status']} ({hw_check_5['details']})")

    # -------------------------------------------------------------
    # Scenario 6: Missing event date / harvest date (Graceful "Needs verification")
    # -------------------------------------------------------------
    print("\n[Scenario 6] Missing event date and missing harvest date (No crashing, Needs verification)...")
    claim_6 = {
        "claim_reference": "TEST-MISSING-06",
        "state": "Karnataka",
        "district": "Dharwad",
        "crop_type": "Rice",
        "season": "Kharif",
        "cultivated_area": 1.0,
        "loss_description": "Severe hailstorm damaged the crop.",
        "growth_stage": "Flowering / Tasseling",
        "loss_date": None,  # Missing!
        "created_at": now.isoformat()
    }
    res_6 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_6)
    dl_check_6 = next(c for c in res_6["checks"] if c["check_id"] == "notification_deadline")
    assert dl_check_6["status"] == "Needs Verification", f"Expected Needs Verification for missing date, got {dl_check_6['status']}"
    assert "Needs Verification" in res_6["preliminary_triage"] or "Further Evidence" in res_6["preliminary_triage"]
    print(f"  Category: {res_6['loss_category']}")
    print(f"  Deadline Check: {dl_check_6['status']} ({dl_check_6['details']})")

    # -------------------------------------------------------------
    # Scenario 7: Missing coverage record and incomplete policy info
    # -------------------------------------------------------------
    print("\n[Scenario 7] Missing coverage records (Unnotified region or missing gazette match)...")
    claim_7 = {
        "claim_reference": "TEST-NOCOV-07",
        "state": "NonExistentState",
        "district": "NonExistentDistrict",
        "crop_type": "ExoticCrop",
        "season": "Kharif",
        "cultivated_area": 1.0,
        "loss_description": "Severe moisture stress."
    }
    res_7 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_7)
    cov_check_7 = next(c for c in res_7["checks"] if c["check_id"] == "coverage_match")
    assert cov_check_7["status"] == "Needs Verification", f"Expected Needs Verification, got {cov_check_7['status']}"
    print(f"  Coverage Match Check: {cov_check_7['status']} ({cov_check_7['details']})")

    # -------------------------------------------------------------
    # Scenario 8: Unknown crops, districts, and empty loss descriptions
    # -------------------------------------------------------------
    print("\n[Scenario 8] Unknown crop, district, and empty loss description...")
    claim_8 = {
        "claim_reference": "TEST-UNKNOWN-08",
        "state": "Mars",
        "district": "Crater",
        "crop_type": "RedDust",
        "season": "Unknown",
        "cultivated_area": 1.0,
        "loss_description": ""
    }
    res_8 = PMFBYRuleAssessmentService.evaluate_claim_rules(claim_8)
    assert res_8["loss_category"] == "Unspecified / Needs Clarification"
    print(f"  Category: {res_8['loss_category']} ({res_8['loss_category_description']})")

    print("\n=================================================================")
    print("ALL 8 PMFBY RULES LOGIC UNIT TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()

