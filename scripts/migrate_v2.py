import sys
import os
import json
from datetime import datetime, timezone

# Add root directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app.database.session import engine, Base, SessionLocal
from backend.app.database.models import User, Claim, FarmerChatHistory, ClaimAssessment, TrainedModel
from backend.app.core.security import hash_password
import sqlite3

def run_migration():
    print("[1/4] Ensuring database tables are created...")
    Base.metadata.create_all(bind=engine)

    # In SQLite, alter table to add columns if they don't exist
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "xai_cropinsure.db")
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(claims);")
        existing_cols = {col[1] for col in cur.fetchall()}

        new_cols = [
            ("user_id", "INTEGER"),
            ("workflow_stage", "VARCHAR(50) DEFAULT 'application_submitted'"),
            ("stage_updated_at", "DATETIME"),
            ("missing_documents", "TEXT DEFAULT '[]'"),
            ("next_expected_action", "TEXT"),
            ("timeline_events_json", "TEXT DEFAULT '[]'"),
            ("verified_crop_loss", "FLOAT"),
            ("officer_notes", "TEXT"),
            ("uploaded_documents_json", "TEXT DEFAULT '[]'"),
            ("payment_status", "VARCHAR(50) DEFAULT 'Pending'"),
            ("payment_amount", "FLOAT"),
            ("payment_date", "VARCHAR(50)"),
            ("payment_reference", "VARCHAR(100)"),
        ]

        for col_name, col_type in new_cols:
            if col_name not in existing_cols:
                try:
                    cur.execute(f"ALTER TABLE claims ADD COLUMN {col_name} {col_type};")
                    print(f"      Added column {col_name} to claims.")
                except Exception as e:
                    print(f"      Column {col_name}: {e}")
        conn.commit()
        conn.close()

    db = SessionLocal()

    print("[2/4] Seeding Authorised Demo Users...")
    users_data = [
        {
            "username": "farmer_ramesh",
            "phone_number": "9876543210",
            "full_name": "Ramesh Patel",
            "role": "farmer",
            "state": "Karnataka",
            "district": "Dharwad",
            "village": "Dharwad Rural",
            "preferred_language": "kn-IN",
            "password": "farmer123"
        },
        {
            "username": "farmer_sunita",
            "phone_number": "9876543211",
            "full_name": "Sunita Devi",
            "role": "farmer",
            "state": "Uttar Pradesh",
            "district": "Barabanki",
            "village": "Masauli",
            "preferred_language": "hi-IN",
            "password": "farmer123"
        },
        {
            "username": "officer_verma",
            "phone_number": "9876543299",
            "full_name": "R. K. Verma",
            "role": "officer",
            "state": "Karnataka",
            "district": "Dharwad",
            "village": "District Office",
            "preferred_language": "en-IN",
            "password": "officer123"
        }
    ]

    for u in users_data:
        existing = db.query(User).filter(User.username == u["username"]).first()
        if not existing:
            new_u = User(
                username=u["username"],
                phone_number=u["phone_number"],
                full_name=u["full_name"],
                role=u["role"],
                state=u["state"],
                district=u["district"],
                village=u["village"],
                preferred_language=u["preferred_language"],
                password_hash=hash_password(u["password"])
            )
            db.add(new_u)
            db.commit()
            print(f"      Created user: {u['username']} ({u['role']})")
        else:
            existing.full_name = u["full_name"]
            existing.preferred_language = u["preferred_language"]
            existing.role = u["role"]
            db.commit()

    ramesh = db.query(User).filter(User.username == "farmer_ramesh").first()
    sunita = db.query(User).filter(User.username == "farmer_sunita").first()

    print("[3/4] Linking and Seeding Farmer-Specific Claims...")

    # Timeline helper
    def make_timeline(stages_completed):
        all_stages = [
            ("application_submitted", "Application Submitted", "10 Oct 2025", "Claim registration received via PMFBY portal with land survey details."),
            ("documents_checked", "Documents Checked", "14 Oct 2025", "Aadhaar e-KYC and land 7/12 RoR records verified with revenue database."),
            ("under_assessment", "Claim Under Assessment", "20 Oct 2025", "Automated agro-climatic pattern analysis and satellite NDVI comparison."),
            ("officer_reviewing", "Officer Reviewing", "24 Oct 2025", "Field inspection report reviewed by authorised District Agriculture Assessor."),
            ("decision_recorded", "Decision Recorded", "28 Oct 2025", "Official decision signed off in accordance with PMFBY operational guidelines."),
            ("payment_processing", "Payment Processing", "02 Nov 2025", "DBT subsidy and payout batch prepared for direct bank transfer."),
            ("payment_completed", "Payment Completed", "05 Nov 2025", "Payment disbursed directly into farmer's Aadhaar-linked savings bank account.")
        ]
        events = []
        for stage_key, title, date_str, note in all_stages:
            if stage_key in stages_completed:
                status = "completed"
            elif len(events) > 0 and events[-1]["status"] == "completed" and stage_key not in stages_completed:
                status = "in_progress"
            else:
                status = "pending"
            events.append({
                "stage": stage_key,
                "title": title,
                "status": status,
                "date": date_str if status == "completed" else "Pending",
                "note": note if status == "completed" else "Awaiting this workflow stage."
            })
        return json.dumps(events)

    uploaded_docs_default = json.dumps([
        {"doc_type": "Identity Proof", "name": "Aadhaar Card (e-KYC verified)", "status": "Verified", "upload_date": "2025-10-10"},
        {"doc_type": "Land Record", "name": "7/12 RoR Extract & Survey No. 44/2", "status": "Verified", "upload_date": "2025-10-10"},
        {"doc_type": "Bank Details", "name": "Bank Passbook with IFSC", "status": "Verified", "upload_date": "2025-10-10"},
        {"doc_type": "Crop Photo", "name": "Field Geo-tagged Damage Photo", "status": "Verified", "upload_date": "2025-10-12"}
    ])

    # Check Ramesh claims
    c1 = db.query(Claim).filter(Claim.claim_reference == "CLM-2025-0001").first()
    if not c1:
        c1 = Claim(
            claim_reference="CLM-2025-0001",
            user_id=ramesh.id,
            farmer_name="Ramesh Patel",
            contact_number="9876543210",
            policy_reference="POL-PMFBY-KAR-8831",
            insurance_scheme="Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            sum_insured=96000.0,
            state="Karnataka",
            district="Dharwad",
            village="Dharwad Rural",
            latitude=15.4589,
            longitude=75.0078,
            crop_type="Rice/Paddy",
            season="Kharif",
            sowing_date="2025-06-15",
            claim_start_date="2025-06-15",
            claim_end_date="2025-10-25",
            loss_date="2025-09-18",
            reported_loss_pct=45.0,
            loss_description="Severe dry spell and acute water deficit during panicle initiation stage causing stunted crop development.",
            growth_stage="Grain Filling / Maturity",
            cultivated_area=2.4,
            expected_yield=4.2,
            observed_yield=2.3,
            soil_type="Black Soil (Vertisol)",
            irrigation_type="Rainfed",
            observed_rainfall=480.0,
            reference_rainfall=720.0,
            soil_moisture=26.0,
            observed_temperature=32.4,
            reference_temperature=29.8,
            current_ndvi=0.38,
            reference_ndvi=0.64,
            status="Model assessed",
            workflow_stage="under_assessment",
            stage_updated_at=datetime.now(timezone.utc),
            missing_documents=json.dumps([]),
            next_expected_action="Automated remote sensing satellite NDVI check completed. Awaiting assessor confirmation.",
            timeline_events_json=make_timeline(["application_submitted", "documents_checked"]),
            verified_crop_loss=None,
            officer_notes=None,
            uploaded_documents_json=uploaded_docs_default,
            payment_status="Pending",
            payment_amount=38500.0,
            is_demo_record=True
        )
        db.add(c1)
        db.commit()
        print("      Created claim CLM-2025-0001 (Ramesh - Rice/Paddy)")
    else:
        c1.user_id = ramesh.id
        c1.farmer_name = "Ramesh Patel"
        c1.contact_number = "9876543210"
        c1.workflow_stage = "under_assessment"
        c1.timeline_events_json = make_timeline(["application_submitted", "documents_checked"])
        c1.uploaded_documents_json = uploaded_docs_default
        c1.missing_documents = json.dumps([])
        c1.next_expected_action = "Automated remote sensing satellite NDVI check completed. Awaiting assessor confirmation."
        db.commit()

    # Second claim for Ramesh (Cotton)
    c2 = db.query(Claim).filter(Claim.claim_reference == "CLM-2025-0002").first()
    if not c2:
        c2 = Claim(
            claim_reference="CLM-2025-0002",
            user_id=ramesh.id,
            farmer_name="Ramesh Patel",
            contact_number="9876543210",
            policy_reference="POL-PMFBY-KAR-8832",
            insurance_scheme="Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            sum_insured=82000.0,
            state="Karnataka",
            district="Dharwad",
            village="Dharwad Rural",
            latitude=15.4610,
            longitude=75.0120,
            crop_type="Cotton",
            season="Kharif",
            sowing_date="2025-06-20",
            claim_start_date="2025-06-20",
            claim_end_date="2025-11-10",
            loss_date="2025-09-25",
            reported_loss_pct=60.0,
            loss_description="Bollworm infestation coupled with mid-season moisture stress causing premature boll dropping.",
            growth_stage="Flowering & Boll Formation",
            cultivated_area=1.8,
            expected_yield=2.5,
            observed_yield=1.1,
            soil_type="Medium Black Soil",
            irrigation_type="Rainfed",
            observed_rainfall=450.0,
            reference_rainfall=710.0,
            soil_moisture=22.0,
            observed_temperature=33.1,
            reference_temperature=29.8,
            current_ndvi=0.32,
            reference_ndvi=0.58,
            status="Additional evidence required",
            workflow_stage="documents_checked",
            stage_updated_at=datetime.now(timezone.utc),
            missing_documents=json.dumps(["Gram Panchayat Sowing Certificate", "Local Pest Infestation Survey Slip"]),
            next_expected_action="Upload the requested Sowing Certificate to proceed with the assessment.",
            timeline_events_json=make_timeline(["application_submitted"]),
            verified_crop_loss=None,
            officer_notes="Officer noticed missing local panchayat sowing declaration.",
            uploaded_documents_json=json.dumps([
                {"doc_type": "Identity Proof", "name": "Aadhaar Card (Verified)", "status": "Verified", "upload_date": "2025-10-10"},
                {"doc_type": "Land Record", "name": "7/12 RoR Survey No. 44/3", "status": "Verified", "upload_date": "2025-10-10"},
                {"doc_type": "Sowing Certificate", "name": "Gram Panchayat Certificate", "status": "Missing", "upload_date": None}
            ]),
            payment_status="Pending",
            payment_amount=None,
            is_demo_record=True
        )
        db.add(c2)
        db.commit()
        print("      Created claim CLM-2025-0002 (Ramesh - Cotton)")
    else:
        c2.user_id = ramesh.id
        c2.farmer_name = "Ramesh Patel"
        c2.contact_number = "9876543210"
        c2.workflow_stage = "documents_checked"
        c2.timeline_events_json = make_timeline(["application_submitted"])
        c2.missing_documents = json.dumps(["Gram Panchayat Sowing Certificate", "Local Pest Infestation Survey Slip"])
        c2.next_expected_action = "Upload the requested Sowing Certificate to proceed with the assessment."
        db.commit()

    # Claim for Sunita (Wheat)
    c3 = db.query(Claim).filter(Claim.claim_reference == "CLM-2025-0003").first()
    if not c3:
        c3 = Claim(
            claim_reference="CLM-2025-0003",
            user_id=sunita.id,
            farmer_name="Sunita Devi",
            contact_number="9876543211",
            policy_reference="POL-PMFBY-UP-4912",
            insurance_scheme="Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            sum_insured=65000.0,
            state="Uttar Pradesh",
            district="Barabanki",
            village="Masauli",
            latitude=26.9248,
            longitude=81.1963,
            crop_type="Wheat",
            season="Rabi",
            sowing_date="2024-11-20",
            claim_start_date="2024-11-20",
            claim_end_date="2025-04-10",
            loss_date="2025-03-05",
            reported_loss_pct=35.0,
            loss_description="Sudden unseasonal hailstorm and high winds causing severe crop lodging during grain formation.",
            growth_stage="Milking & Dough Stage",
            cultivated_area=1.5,
            expected_yield=4.0,
            observed_yield=2.8,
            soil_type="Alluvial Loam",
            irrigation_type="Tubewell Irrigated",
            observed_rainfall=85.0,
            reference_rainfall=35.0,
            soil_moisture=45.0,
            observed_temperature=27.5,
            reference_temperature=26.0,
            current_ndvi=0.45,
            reference_ndvi=0.62,
            status="Awaiting human review",
            workflow_stage="officer_reviewing",
            stage_updated_at=datetime.now(timezone.utc),
            missing_documents=json.dumps([]),
            next_expected_action="Awaiting final review decision and claim approval by Block Agriculture Assessor.",
            timeline_events_json=make_timeline(["application_submitted", "documents_checked", "under_assessment"]),
            verified_crop_loss=32.0,
            officer_notes="Preliminary CCE sampling verified ~32% physical grain damage from hailstorm.",
            uploaded_documents_json=uploaded_docs_default,
            payment_status="Processing",
            payment_amount=21500.0,
            is_demo_record=True
        )
        db.add(c3)
        db.commit()
        print("      Created claim CLM-2025-0003 (Sunita - Wheat)")
    else:
        c3.user_id = sunita.id
        c3.farmer_name = "Sunita Devi"
        c3.contact_number = "9876543211"
        c3.workflow_stage = "officer_reviewing"
        c3.timeline_events_json = make_timeline(["application_submitted", "documents_checked", "under_assessment"])
        c3.verified_crop_loss = 32.0
        db.commit()

    # Also update any other demo claims to point to users or leave as unassigned
    db.close()
    print("[4/4] Migration and Seeding Completed Successfully!")

if __name__ == "__main__":
    run_migration()

