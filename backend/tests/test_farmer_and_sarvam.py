import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_auth_demo_users_and_switching():
    # 1. List demo users
    res = client.get("/api/auth/demo-users")
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 2
    usernames = [u["username"] for u in users]
    assert "farmer_ramesh" in usernames
    assert "farmer_sunita" in usernames

    # 2. Switch to Ramesh
    res_ramesh = client.post("/api/auth/demo-switch?username=farmer_ramesh")
    assert res_ramesh.status_code == 200
    data_ramesh = res_ramesh.json()
    assert data_ramesh["user"]["username"] == "farmer_ramesh"
    assert data_ramesh["user"]["role"] == "farmer"
    token_ramesh = data_ramesh["access_token"]
    assert token_ramesh

    # 3. Check /me with token
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_ramesh}"})
    assert res_me.status_code == 200
    assert res_me.json()["full_name"] == "Ramesh Patel"

def test_farmer_claims_scoping_and_cross_access_block():
    # 1. Login as Ramesh
    res_r = client.post("/api/auth/demo-switch?username=farmer_ramesh")
    token_ramesh = res_r.json()["access_token"]
    headers_ramesh = {"Authorization": f"Bearer {token_ramesh}"}

    # 2. Ramesh gets his claims
    res_claims_r = client.get("/api/farmer/claims", headers=headers_ramesh)
    assert res_claims_r.status_code == 200
    r_claims = res_claims_r.json()
    assert len(r_claims) >= 1
    # Ramesh has CLM-2025-0001
    ramesh_claim_refs = [c["claim_reference"] for c in r_claims]
    assert "CLM-2025-0001" in ramesh_claim_refs
    assert "CLM-2025-0003" not in ramesh_claim_refs # Sunita's claim should NOT be in Ramesh's list!

    # 3. Login as Sunita
    res_s = client.post("/api/auth/demo-switch?username=farmer_sunita")
    token_sunita = res_s.json()["access_token"]
    headers_sunita = {"Authorization": f"Bearer {token_sunita}"}

    # 4. Sunita gets her claims
    res_claims_s = client.get("/api/farmer/claims", headers=headers_sunita)
    assert res_claims_s.status_code == 200
    s_claims = res_claims_s.json()
    sunita_claim_refs = [c["claim_reference"] for c in s_claims]
    assert "CLM-2025-0003" in sunita_claim_refs
    assert "CLM-2025-0001" not in sunita_claim_refs # Ramesh's claim should NOT be in Sunita's list!

    # 5. SECURITY CHECK: Sunita tries to directly request Ramesh's claim details
    ramesh_claim_id = [c["id"] for c in r_claims if c["claim_reference"] == "CLM-2025-0001"][0]
    res_forbidden = client.get(f"/api/farmer/claims/{ramesh_claim_id}", headers=headers_sunita)
    # MUST return 403 Forbidden!
    assert res_forbidden.status_code == 403
    assert "Access denied" in res_forbidden.json()["detail"]

def test_farmer_damage_info_and_timeline():
    # Login as Ramesh
    res_r = client.post("/api/auth/demo-switch?username=farmer_ramesh")
    headers = {"Authorization": f"Bearer {res_r.json()['access_token']}"}
    r_claims = client.get("/api/farmer/claims", headers=headers).json()
    c1_id = r_claims[0]["id"]

    # 1. Timeline
    res_timeline = client.get(f"/api/farmer/claims/{c1_id}/timeline", headers=headers)
    assert res_timeline.status_code == 200
    tl = res_timeline.json()
    assert "stages" in tl
    assert len(tl["stages"]) >= 5
    assert tl["current_stage"]

    # 2. Damage info (4-part separation)
    res_dmg = client.get(f"/api/farmer/claims/{c1_id}/damage-info", headers=headers)
    assert res_dmg.status_code == 200
    dmg = res_dmg.json()
    assert "farmer_reported" in dmg
    assert "external_sources" in dmg
    assert "ai_estimated" in dmg
    assert "officer_verified" in dmg
    assert dmg["farmer_reported"]["source_type"] == "Reported by Farmer"
    assert "Explainable AI" in dmg["ai_estimated"]["source_type"]

    # 3. Explanation
    res_exp = client.get(f"/api/farmer/claims/{c1_id}/explanation", headers=headers)
    assert res_exp.status_code == 200
    exp = res_exp.json()
    assert "main_reasons" in exp
    assert len(exp["main_reasons"]) >= 2
    assert "statutory_note" in exp

def test_farmer_assistant_chat():
    res_r = client.post("/api/auth/demo-switch?username=farmer_ramesh")
    headers = {"Authorization": f"Bearer {res_r.json()['access_token']}"}
    r_claims = client.get("/api/farmer/claims", headers=headers).json()
    c1_id = r_claims[0]["id"]

    # English query
    res_chat = client.post(
        "/api/farmer/assistant/chat",
        headers=headers,
        json={"claim_id": c1_id, "message": "What is happening with my claim?", "language_code": "en-IN"}
    )
    assert res_chat.status_code == 200
    data = res_chat.json()
    assert data["role"] == "assistant"
    assert len(data["content"]) > 10
    assert len(data["suggested_followups"]) > 0

    # Regional language query (Kannada)
    res_chat_kn = client.post(
        "/api/farmer/assistant/chat",
        headers=headers,
        json={"claim_id": c1_id, "message": "Which documents do I need?", "language_code": "kn-IN"}
    )
    assert res_chat_kn.status_code == 200
    assert len(res_chat_kn.json()["content"]) > 5

def test_sarvam_regional_endpoints():
    # 1. Languages
    res_lang = client.get("/api/regional/languages")
    assert res_lang.status_code == 200
    langs = res_lang.json()["languages"]
    codes = [l["code"] for l in langs]
    assert "kn-IN" in codes
    assert "hi-IN" in codes
    assert "ta-IN" in codes

    # 2. Translation fallback dictionary
    res_tr = client.post(
        "/api/regional/translate",
        json={"text": "Welcome to CropInsure!", "target_language": "kn-IN"}
    )
    assert res_tr.status_code == 200
    assert "ಕ್ರಾಪ್‌ಇನ್ಶೂರ್‌ಗೆ ಸುಸ್ವಾಗತ!" in res_tr.json()["translated_text"]

def test_officer_dashboard_summary():
    res_off = client.post("/api/auth/demo-switch?username=officer_verma")
    headers = {"Authorization": f"Bearer {res_off.json()['access_token']}"}

    res_sum = client.get("/api/officer/dashboard/summary", headers=headers)
    assert res_sum.status_code == 200
    data = res_sum.json()
    assert "Overall Claim Statistics" in data["title"]
    assert "kpis" in data
    assert data["kpis"]["total_claims"] >= 3

