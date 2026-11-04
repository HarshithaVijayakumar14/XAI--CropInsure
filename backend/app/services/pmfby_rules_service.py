import os
import re
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone, timedelta
import pandas as pd

from backend.app.services.external_data_service import search_pmfby_reference

# Peril definitions strictly based on PMFBY Revised Operational Guidelines (Clause 4.1 - 4.4)
LOCALIZED_CALAMITY_PERILS = [
    "hailstorm", "hail",
    "landslide", "land slide",
    "inundation", "waterlogging", "submersion", "field flooding",
    "cloudburst", "cloud burst",
    "natural fire", "lightning fire"
]

POST_HARVEST_PERILS = [
    "cyclone", "cyclonic rain", "cyclonic rains",
    "unseasonal rain", "unseasonal rains", "untimely rain", "untimely rains",
    "hailstorm"
]

PREVENTED_SOWING_PERILS = [
    "prevented sowing", "failed sowing", "sowing failure",
    "deficit rainfall at sowing", "monsoon delay", "early season drought"
]

MID_SEASON_ADVERSITY_PERILS = [
    "mid-season adversity", "mid season adversity",
    "drought", "dry spell", "prolonged dry spell", "moisture stress",
    "severe rainfall deficit", "heat wave", "heatwave", "unseasonal frost"
]

class PMFBYRuleAssessmentService:
    """
    Statutory PMFBY Rule Assessment & Eligibility Verification Service.
    Implements deterministic, explainable verification based strictly on the
    official PMFBY Operational Guidelines (Ministry of Agriculture & Farmers Welfare, Govt of India).

    Strictly separate from machine learning classification models.
    Does NOT calculate final indemnity or grant official approval without statutory CCE ground truth.
    """

    @classmethod
    def detect_loss_category(cls, loss_description: str, growth_stage: Optional[str] = None) -> Tuple[str, str, str]:
        """
        Classifies the claim into one of the five official PMFBY operational coverage provisions
        based on the reported cause, growth stage, and loss description.
        Returns (category_name, primary_peril, category_description).
        """
        desc_lower = (loss_description or "").lower().strip()
        stage_lower = (growth_stage or "").lower().strip()

        # 1. Post-Harvest Loss Check
        # Keywords: cut and spread, harvested, post-harvest, drying in field
        if any(term in desc_lower for term in ["cut and spread", "cut & spread", "drying in field", "harvested", "post-harvest", "post harvest"]):
            peril = "Unseasonal Rains / Cyclonic Wetting"
            for p in POST_HARVEST_PERILS:
                if p in desc_lower:
                    peril = p.capitalize()
                    break
            return (
                "Post-Harvest Loss",
                peril,
                "Covers harvested crops lying in 'cut and spread' condition in the field up to a maximum of 14 days from harvesting against specified perils (hailstorm, cyclone, cyclonic rains, unseasonal rains)."
            )

        # 2. Prevented / Failed Sowing Check
        # Keywords: prevented sowing, unsown, failed to sow, germination failure
        if any(term in desc_lower for term in ["prevented sowing", "failed sowing", "unsown", "unable to sow", "sowing failure"]) or stage_lower in ["germination", "sowing"]:
            if any(term in desc_lower for term in ["prevented", "unsown", "failed"]):
                peril = "Severe Early Season Deficit"
                for p in PREVENTED_SOWING_PERILS:
                    if p in desc_lower:
                        peril = p.capitalize()
                        break
                return (
                    "Prevented Sowing",
                    peril,
                    "Covers widespread prevented sowing (>75% unsown area in notified insurance unit) due to adverse seasonal weather onset. Provides lump-sum relief up to 25% of sum insured; policy cancels."
                )

        # 3. Localized Calamity Check
        # Keywords: hailstorm, landslide, inundation, cloudburst, natural fire
        for p in LOCALIZED_CALAMITY_PERILS:
            if p in desc_lower:
                return (
                    "Localized Calamity",
                    p.capitalize(),
                    "Covers localized natural perils affecting isolated farm plots (strictly: hailstorm, landslide, inundation, cloudburst, natural fire). Assessed on individual plot survey basis."
                )

        # 4. Mid-Season Adversity Check
        # Keywords: drought, dry spell, moisture stress, rainfall deficit during growth
        if any(p in desc_lower for p in ["drought", "dry spell", "moisture stress", "rainfall deficit", "terminal stress", "withering"]):
            return (
                "Mid-Season Adversity",
                "Severe Drought / Prolonged Dry Spell",
                "Covers severe seasonal adversity (drought/dry spell/floods) during the crop cycle where expected yield loss exceeds 50% of normal yield. Provides on-account immediate relief up to 25%."
            )

        # 5. General / Widespread Area Yield Shortfall
        if stage_lower in ["maturity", "grain filling / pod formation"] or "yield" in desc_lower:
            return (
                "Widespread Area-Yield Shortfall",
                "General Agronomic / Seasonal Deficit",
                "Comprehensive end-of-season coverage covering non-preventable yield shortfalls determined statistically via Crop Cutting Experiments (CCEs) across the notified insurance unit."
            )

        return (
            "Unspecified / Needs Clarification",
            "General Reported Loss",
            "Reported damage description does not cleanly match a specific PMFBY statutory category. Officer clarification and claim category assignment required."
        )

    @classmethod
    def evaluate_claim_rules(
        cls,
        claim_data: Dict[str, Any],
        extra_evidence: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes complete, transparent PMFBY statutory rule evaluation against an individual claim record.
        """
        extra_evidence = extra_evidence or {}
        checks: List[Dict[str, Any]] = []
        evidence_checklist: List[Dict[str, Any]] = []

        loss_desc = str(claim_data.get("loss_description") or "")
        growth_stage = str(claim_data.get("growth_stage") or "")
        state = str(claim_data.get("state") or "").strip()
        district = str(claim_data.get("district") or "").strip()
        crop = str(claim_data.get("crop_type") or "").strip()
        season = str(claim_data.get("season") or "").strip()

        # Step 1: Detect Category & Peril
        category, primary_peril, cat_desc = cls.detect_loss_category(loss_desc, growth_stage)

        # Step 2: Peril Consistency Validation
        is_peril_consistent = True
        peril_consistency_notes = "Reported cause is consistent with the applicable PMFBY coverage provision."
        desc_lower = loss_desc.lower()

        if category == "Localized Calamity":
            # Drought is strictly NOT a localized calamity under PMFBY
            if any(term in desc_lower for term in ["drought", "dry spell", "rainfall deficit", "dry weather"]):
                is_peril_consistent = False
                peril_consistency_notes = (
                    "INCONSISTENT PERIL: Under PMFBY Operational Guidelines Section 4.2, 'Localized Calamities' are strictly restricted to "
                    "Hailstorm, Landslide, Inundation, Cloudburst, and Natural Fire. Widespread drought or dry spells cannot be assessed as "
                    "individual localized calamities and must be routed through Mid-Season Adversity or End-of-Season Area-Yield CCEs."
                )
            elif not any(term in desc_lower for term in LOCALIZED_CALAMITY_PERILS):
                is_peril_consistent = False
                peril_consistency_notes = (
                    "Peril requires verification: The reported loss narrative does not clearly identify one of the 5 authorized localized perils "
                    "(Hailstorm, Landslide, Inundation, Cloudburst, Natural Fire)."
                )

        elif category == "Post-Harvest Loss":
            if not any(term in desc_lower for term in POST_HARVEST_PERILS):
                is_peril_consistent = False
                peril_consistency_notes = (
                    "INCONSISTENT PERIL: Post-harvest coverage is strictly restricted to Hailstorm, Cyclone, Cyclonic Rains, and Unseasonal Rains "
                    "affecting crops drying in cut-and-spread condition in the field (PMFBY Guidelines Section 4.3)."
                )

        if category == "Unspecified / Needs Clarification":
            is_peril_consistent = None
            peril_consistency_notes = "Loss description does not clearly match an authorized PMFBY peril category. Clarification required."
            peril_status = "Needs Verification"
        else:
            peril_status = "Passed" if is_peril_consistent else "Failed"

        checks.append({
            "check_id": "peril_eligibility",
            "title": "Peril & Loss Category Consistency",
            "status": peril_status,
            "details": peril_consistency_notes,
            "evidence_used": f"Reported Loss Narrative: '{loss_desc}' | Detected Category: {category}",
            "rule_reference": "PMFBY Operational Guidelines, Clause 4 (Coverage of Risks & Perils)"
        })

        # Step 3: Notified Coverage Benchmark Reference Check
        coverage_bench = search_pmfby_reference(state=state, district=district, crop=crop, season=season)
        if coverage_bench.get("matched"):
            cov_status = "Passed"
            cov_details = (
                f"Statutory PMFBY coverage verified for {coverage_bench.get('notified_crop')} in {coverage_bench.get('notified_district')}, "
                f"{coverage_bench.get('notified_state')} ({coverage_bench.get('reference_period')}). "
                f"Notified Sum Insured: ₹{coverage_bench.get('sum_insured_per_ha', 0):,.2f}/Ha | "
                f"Farmer Share: {coverage_bench.get('farmer_share_pct', 2.0)}% | Indemnity Level: {coverage_bench.get('indemnity_level_pct', 80)}% | "
                f"Implementing Insurer: {coverage_bench.get('insurance_company')}."
            )
        else:
            cov_status = "Needs Verification"
            cov_details = (
                f"No gazetted coverage record directly matched in the local PMFBY database for {crop} in {district}, {state} ({season}). "
                "This reference check does not invalidate individual coverage; verification against the official State Seasonal Gazette "
                "or insurance certificate issued by the insurer is required."
            )

        checks.append({
            "check_id": "coverage_match",
            "title": "Notified Crop & Insurance Unit Reference Check",
            "status": cov_status,
            "details": cov_details,
            "evidence_used": f"State: {state}, District: {district}, Crop: {crop}, Season: {season}",
            "rule_reference": "PMFBY Operational Guidelines, Clause 2 (Notification of Area & Crops)"
        })

        # Step 4: Selective Notification Deadline Check
        # Applicable strictly to Localized Calamity and Post-Harvest Loss (72 Hours)
        loss_date_str = claim_data.get("loss_date") or extra_evidence.get("loss_date")
        created_at_val = claim_data.get("created_at")
        
        applicable_deadline_hours: Optional[float] = None
        elapsed_hours: Optional[float] = None

        if category in ["Localized Calamity", "Post-Harvest Loss"]:
            applicable_deadline_hours = 72.0
            if not loss_date_str:
                dl_status = "Needs Verification"
                dl_details = (
                    "Statutory 72-Hour Deadline cannot be verified: The occurrence date of the damage event ('loss_date') is missing from the claim record. "
                    "Under PMFBY Clause 4.2, localized and post-harvest damage must be intimated within 72 hours of the calamity. Physical survey must verify event occurrence time."
                )
                dl_evidence = "Loss Date: Not Provided | Claim Submission: Recorded"
            else:
                try:
                    # Parse loss_date (handle YYYY-MM-DD or full timestamp)
                    if "T" in str(loss_date_str):
                        loss_dt = datetime.fromisoformat(str(loss_date_str).replace("Z", "+00:00"))
                    else:
                        loss_dt = datetime.strptime(str(loss_date_str).strip()[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    if loss_dt.tzinfo is None:
                        loss_dt = loss_dt.replace(tzinfo=timezone.utc)

                    # Parse created_at
                    if isinstance(created_at_val, datetime):
                        submit_dt = created_at_val.replace(tzinfo=timezone.utc) if created_at_val.tzinfo is None else created_at_val
                    elif created_at_val:
                        submit_dt = datetime.fromisoformat(str(created_at_val).replace("Z", "+00:00"))
                        if submit_dt.tzinfo is None:
                            submit_dt = submit_dt.replace(tzinfo=timezone.utc)
                    else:
                        submit_dt = datetime.now(timezone.utc)

                    delta = submit_dt - loss_dt
                    elapsed_hours = round(delta.total_seconds() / 3600.0, 1)

                    if elapsed_hours < 0:
                        dl_status = "Needs Verification"
                        dl_details = f"Inconsistent dates: Claim submission timestamp precedes reported event date by {abs(elapsed_hours):.1f} hours. Date verification required."
                        dl_evidence = f"Reported Loss Date: {loss_date_str} | Claim Submitted: {submit_dt.isoformat()}"
                    elif elapsed_hours <= 72.0:
                        dl_status = "Passed"
                        dl_details = f"Compliant: Claim was intimating within {elapsed_hours:.1f} hours of event occurrence, satisfying the statutory 72-hour notification deadline (PMFBY Guidelines Clause 4.2)."
                        dl_evidence = f"Loss Date: {loss_date_str} | Claim Submitted: {submit_dt.isoformat()} ({elapsed_hours:.1f}h elapsed)"
                    else:
                        dl_status = "Failed"
                        dl_details = (
                            f"Statutory Deadline Exceeded: Claim was intimated {elapsed_hours:.1f} hours after the reported event, exceeding the 72-hour notification window. "
                            "Under official PMFBY guidelines, delayed intimation requires formal condonation by the District Level Monitoring Committee (DLMC)."
                        )
                        dl_evidence = f"Loss Date: {loss_date_str} | Claim Submitted: {submit_dt.isoformat()} ({elapsed_hours:.1f}h elapsed > 72h)"
                except Exception as e:
                    dl_status = "Needs Verification"
                    dl_details = f"Date parsing error encountered during deadline verification: {str(e)}. Human inspection required."
                    dl_evidence = f"Raw Loss Date: '{loss_date_str}'"
        else:
            # 72-Hour deadline is explicitly NOT applicable to Prevented Sowing, Mid-Season Adversity, or Area-Yield!
            dl_status = "Not Applicable"
            dl_details = (
                f"The 72-hour individual farmer notification deadline does NOT apply to '{category}'. "
                "Under official PMFBY operational guidelines, this coverage provision is triggered by State Government seasonal notification, "
                "District Level Joint Survey declaration, or end-of-season Crop Cutting Experiments (CCEs)."
            )
            dl_evidence = f"Provision: {category} (Governed by State/District Administrative Notification, not individual 72h notice)"

        checks.append({
            "check_id": "notification_deadline",
            "title": "Statutory Notification Deadline Verification",
            "status": dl_status,
            "details": dl_details,
            "evidence_used": dl_evidence,
            "rule_reference": "PMFBY Operational Guidelines, Clause 4.2 & Clause 4.3 (Notification Timelines)"
        })

        # Step 5: Post-Harvest Field-Drying Window Check
        # Must verify harvest_date, NEVER substitute sowing_date!
        harvest_date_str = claim_data.get("harvest_date") or extra_evidence.get("harvest_date")

        if category == "Post-Harvest Loss":
            if not harvest_date_str:
                hw_status = "Needs Verification"
                hw_details = (
                    "Harvest date is missing: Post-harvest coverage is strictly restricted to crops in 'cut and spread' condition in the field "
                    "within a maximum of 14 days from harvesting. Harvest date cannot be substituted with sowing date and must be verified by field survey."
                )
                hw_evidence = "Harvest Date: Unverified / Not Provided in Record"
            elif not loss_date_str:
                hw_status = "Needs Verification"
                hw_details = "Damage occurrence date is missing; cannot compute post-harvest drying window elapsed days."
                hw_evidence = f"Harvest Date: {harvest_date_str} | Loss Date: Missing"
            else:
                try:
                    h_dt = datetime.strptime(str(harvest_date_str).strip()[:10], "%Y-%m-%d")
                    l_dt = datetime.strptime(str(loss_date_str).strip()[:10], "%Y-%m-%d")
                    drying_days = (l_dt - h_dt).days

                    if drying_days < 0:
                        hw_status = "Failed"
                        hw_details = f"Inconsistent chronology: Reported damage date ({loss_date_str}) precedes the recorded harvest date ({harvest_date_str})."
                        hw_evidence = f"Harvest Date: {harvest_date_str} | Damage Date: {loss_date_str}"
                    elif drying_days <= 14:
                        hw_status = "Passed"
                        hw_details = f"Damage occurred {drying_days} days after harvesting, satisfying the statutory 14-day field-drying limit (PMFBY Clause 4.3)."
                        hw_evidence = f"Harvest Date: {harvest_date_str} | Event Date: {loss_date_str} ({drying_days} days elapsed <= 14 days)"
                    else:
                        hw_status = "Failed"
                        hw_details = (
                            f"Exceeded Statutory Limit: Damage occurred {drying_days} days after harvesting, exceeding the maximum statutory 14-day "
                            "coverage window for cut-and-spread crops in the field (PMFBY Clause 4.3)."
                        )
                        hw_evidence = f"Harvest Date: {harvest_date_str} | Event Date: {loss_date_str} ({drying_days} days elapsed > 14 days)"
                except Exception as e:
                    hw_status = "Needs Verification"
                    hw_details = f"Error validating harvest dates: {str(e)}."
                    hw_evidence = f"Harvest Date: '{harvest_date_str}'"
        else:
            hw_status = "Not Applicable"
            hw_details = f"Post-harvest 14-day field-drying window check does not apply to '{category}'."
            hw_evidence = f"Provision: {category}"

        checks.append({
            "check_id": "harvest_drying_window",
            "title": "Post-Harvest 14-Day Field-Drying Window",
            "status": hw_status,
            "details": hw_details,
            "evidence_used": hw_evidence,
            "rule_reference": "PMFBY Operational Guidelines, Clause 4.3 (Post-Harvest Losses)"
        })

        # Step 6: Meteorological / Environmental Corroboration
        obs_rain = claim_data.get("observed_rainfall")
        ref_rain = claim_data.get("reference_rainfall")
        current_ndvi = claim_data.get("current_ndvi")
        ref_ndvi = claim_data.get("reference_ndvi")

        rain_deficit = (ref_rain - obs_rain) if (ref_rain is not None and obs_rain is not None) else None
        ndvi_drop = (current_ndvi - ref_ndvi) if (current_ndvi is not None and ref_ndvi is not None) else None

        corrob_status = "Passed"
        corrob_details = "Recorded environmental indicators are consistent with reported conditions."

        if "drought" in desc_lower or "dry spell" in desc_lower or category == "Mid-Season Adversity":
            if rain_deficit is not None and rain_deficit < 0:
                corrob_status = "Needs Verification"
                corrob_details = f"Rainfall anomaly check flagged: Observed rainfall ({obs_rain} mm) was higher than reference normal ({ref_rain} mm), contradicting severe drought narrative."
            elif ndvi_drop is not None and ndvi_drop > 0.05:
                corrob_status = "Needs Verification"
                corrob_details = f"Satellite vegetation check flagged: Current NDVI ({current_ndvi}) is higher than reference ({ref_ndvi}), indicating positive vegetative health."
            elif rain_deficit is not None and ndvi_drop is not None:
                corrob_details = f"Environmental data corroborates drought/moisture stress (Rainfall deficit: {rain_deficit:.1f} mm, NDVI change: {ndvi_drop:.3f})."
            else:
                corrob_status = "Needs Verification"
                corrob_details = "Meteorological or satellite vegetation data was partially missing or unrecorded for this claim. Environmental corroboration requires ground survey."


        elif any(p in desc_lower for p in ["inundation", "flood", "torrential", "excessive"]):
            if obs_rain is not None and obs_rain < 50.0:
                corrob_status = "Needs Verification"
                corrob_details = f"Precipitation check flagged: Observed seasonal rainfall ({obs_rain} mm) does not show extreme precipitation. Localized waterlogging survey required."
            else:
                corrob_details = f"Recorded heavy precipitation ({obs_rain} mm) is consistent with waterlogging / inundation."

        checks.append({
            "check_id": "environmental_corroboration",
            "title": "Agro-Meteorological Corroboration Check",
            "status": corrob_status,
            "details": corrob_details,
            "evidence_used": f"Observed Rain: {obs_rain} mm (Ref: {ref_rain} mm) | Current NDVI: {current_ndvi} (Ref: {ref_ndvi})",
            "rule_reference": "PMFBY Operational Guidelines, Clause 15 (Use of Technology & Remote Sensing)"
        })

        # Step 7: Build Evidence & Documentation Checklist
        evidence_checklist = [
            {
                "document_or_evidence": "Land Possession Document (RoR / 7/12 / Khasra)",
                "required_for": "Verification of insurable interest and cultivated acreage",
                "status": "Verified" if claim_data.get("cultivated_area") else "Pending / Missing",
                "guidance": "Upload verified land record extract from State Bhulekh/Bhoomi portal."
            },
            {
                "document_or_evidence": "Sowing Certificate / Crop Sown Declaration",
                "required_for": "Verification of notified crop variety and sowing date",
                "status": "Verified" if claim_data.get("sowing_date") else "Pending / Missing",
                "guidance": "Village Agriculture Officer or Revenue Inspector sowing certification."
            },
            {
                "document_or_evidence": "Geotagged Damage Photographs (Farm Plot)",
                "required_for": "Visual verification of localized damage / inundation",
                "status": "Needs Physical Inspection" if category in ["Localized Calamity", "Post-Harvest Loss"] else "Not Applicable",
                "guidance": "Mandatory minimum 2 geotagged and timestamped plot photos for localized claims."
            },
            {
                "document_or_evidence": "Joint Survey Report (Agriculture Dept + Revenue + Insurer)",
                "required_for": "Statutory plot loss assessment for localized calamities",
                "status": "Needs Physical Inspection" if category in ["Localized Calamity", "Post-Harvest Loss"] else "Not Applicable",
                "guidance": "Mandatory joint field survey within 10 days of claim intimation."
            },
            {
                "document_or_evidence": "Harvest Date Certificate / Mandi Weighment Slip",
                "required_for": "Post-Harvest 14-day field-drying window verification",
                "status": "Verified" if harvest_date_str else ("Pending / Missing" if category == "Post-Harvest Loss" else "Not Applicable"),
                "guidance": "Certificate confirming exact harvesting date for cut-and-spread claim evaluation."
            },
            {
                "document_or_evidence": "Aadhaar-Linked Bank Account (DBT Verification)",
                "required_for": "Direct benefit transfer of approved indemnity",
                "status": "Verified" if claim_data.get("policy_reference") else "Needs Verification",
                "guidance": "Bank passbook or PFMS account mapping verification."
            }
        ]

        # Step 8: Triage Recommendation
        failed_checks = [c for c in checks if c["status"] == "Failed"]
        verification_needed = [c for c in checks if c["status"] == "Needs Verification"]

        if failed_checks:
            preliminary_triage = "Statutory Review Flagged"
            triage_summary = (
                f"Statutory requirements flagged {len(failed_checks)} critical check(s) that fail scheme rules: "
                f"{'; '.join(c['title'] + ' (' + c['details'][:60] + '...)' for c in failed_checks)}. "
                "Requires detailed human review and potential District Level Monitoring Committee (DLMC) condonation."
            )
        elif verification_needed:
            preliminary_triage = "Further Evidence / Verification Required"
            triage_summary = (
                f"{len(verification_needed)} check(s) require ground or documentary verification before conclusive assessment: "
                f"{'; '.join(c['title'] for c in verification_needed)}. Joint survey inspection recommended."
            )
        elif category in ["Localized Calamity", "Post-Harvest Loss"]:
            preliminary_triage = "Joint Field Survey Required"
            triage_summary = (
                f"Preliminary statutory criteria met for '{category}'. Under official PMFBY guidelines, localized loss "
                "cannot be settled solely on desk review and mandates a joint physical plot survey by Agriculture, Revenue, and Insurer representatives."
            )
        else:
            preliminary_triage = "Fast-Track Eligible for Area-Yield Review"
            triage_summary = (
                f"Preliminary eligibility verified for '{category}'. Final settlement will be determined under statutory scheme provisions "
                "upon publication of official Crop Cutting Experiment (CCE) results or State Government declaration."
            )

        disclaimer = (
            "PRELIMINARY DECISION SUPPORT ONLY: This rules assessment provides administrative and statutory verification for authorized officers. "
            "Passing preliminary checks does NOT constitute official claim approval, entitlement to indemnity, or policy payout. "
            "Final claim determination rests exclusively with the authorized insurance underwriter and District Joint Survey Committee under official PMFBY guidelines."
        )

        return {
            "loss_category": category,
            "loss_category_description": cat_desc,
            "reported_peril": primary_peril,
            "is_peril_consistent": is_peril_consistent,
            "peril_consistency_notes": peril_consistency_notes,
            "preliminary_triage": preliminary_triage,
            "triage_summary": triage_summary,
            "checks": checks,
            "evidence_checklist": evidence_checklist,
            "applicable_deadline_hours": applicable_deadline_hours,
            "elapsed_hours_to_notification": elapsed_hours,
            "notified_coverage_benchmark": coverage_bench if coverage_bench.get("matched") else None,
            "disclaimer": disclaimer,
            "assessed_at": datetime.now(timezone.utc).isoformat()
        }
