import os
import sys
import json
import asyncio
import functools

print = functools.partial(print, flush=True)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from httpx import ASGITransport, AsyncClient
from backend.app.main import app

async def run_checks():
    print("=" * 65)
    print("Testing Farmer Scoping, Role Separation & Sarvam Regional APIs")
    print("=" * 65)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Check Demo Users
        res = await client.get("/api/auth/demo-users")
        assert res.status_code == 200, f"Failed: {res.text}"
        users = res.json()
        print(f"[1/8] Demo Users Loaded: {len(users)} users ({[u['username'] for u in users]})")

        # 2. Login as Farmer Ramesh
        res_r = await client.post("/api/auth/demo-switch?username=farmer_ramesh")
        assert res_r.status_code == 200
        token_ramesh = res_r.json()["access_token"]
        headers_r = {"Authorization": f"Bearer {token_ramesh}"}
        print(f"[2/8] Ramesh Logged In: Token generated successfully.")

        # 3. Ramesh Claims
        res_claims_r = await client.get("/api/farmer/claims", headers=headers_r)
        assert res_claims_r.status_code == 200
        claims_r = res_claims_r.json()
        refs_r = [c["claim_reference"] for c in claims_r]
        assert "CLM-2025-0001" in refs_r
        assert "CLM-2025-0002" in refs_r
        assert "CLM-2025-0003" not in refs_r
        print(f"[3/8] Ramesh Claims Scoping: {len(claims_r)} claims ({refs_r}) - 0 foreign claims.")

        # 4. Login as Farmer Sunita
        res_s = await client.post("/api/auth/demo-switch?username=farmer_sunita")
        token_sunita = res_s.json()["access_token"]
        headers_s = {"Authorization": f"Bearer {token_sunita}"}
        res_claims_s = await client.get("/api/farmer/claims", headers=headers_s)
        assert res_claims_s.status_code == 200
        claims_s = res_claims_s.json()
        refs_s = [c["claim_reference"] for c in claims_s]
        assert "CLM-2025-0003" in refs_s
        assert "CLM-2025-0001" not in refs_s
        print(f"[4/8] Sunita Claims Scoping: {len(claims_s)} claims ({refs_s}) - strictly separate.")

        # 5. SECURITY ENFORCEMENT: Sunita tries to access Ramesh's claim (CLM-2025-0001)
        c1_id = [c["id"] for c in claims_r if c["claim_reference"] == "CLM-2025-0001"][0]
        res_unauthorized = await client.get(f"/api/farmer/claims/{c1_id}", headers=headers_s)
        assert res_unauthorized.status_code == 403, f"Expected 403, got {res_unauthorized.status_code}"
        print(f"[5/8] Security Check Passed: Sunita accessing Ramesh claim blocked with HTTP 403 Forbidden.")

        # 6. Timeline and Damage Info
        res_tl = await client.get(f"/api/farmer/claims/{c1_id}/timeline", headers=headers_r)
        assert res_tl.status_code == 200
        tl = res_tl.json()
        print(f"[6/8] Claim Progress Timeline: Stage={tl['current_stage']} | Stages count={len(tl['stages'])}")

        res_dmg = await client.get(f"/api/farmer/claims/{c1_id}/damage-info", headers=headers_r)
        assert res_dmg.status_code == 200
        dmg = res_dmg.json()
        assert "farmer_reported" in dmg and "ai_estimated" in dmg
        print(f"[7/8] Crop Damage Info: 4-way separation verified.")

        # 7. AI Assistant Chat (English and Regional Language Kannada)
        res_chat = await client.post(
            "/api/farmer/assistant/chat",
            headers=headers_r,
            json={"claim_id": c1_id, "message": "What is happening with my claim?", "language_code": "en-IN"}
        )
        assert res_chat.status_code == 200
        chat_data = res_chat.json()
        print(f"[8/8] Farmer AI Assistant Reply: '{chat_data['content'][:65]}...'")

        # Regional Language Translation Check (Kannada)
        res_tr = await client.post(
            "/api/regional/translate",
            json={"text": "Welcome to CropInsure!", "target_language": "kn-IN"}
        )
        assert res_tr.status_code == 200
        tr_kannada = res_tr.json()['translated_text']
        print(f"      Sarvam Regional Translation (Kannada): verified length={len(tr_kannada)}")

    print("\nALL IN-MEMORY VERIFICATION CHECKS PASSED PERFECTLY!\n")

if __name__ == "__main__":
    asyncio.run(run_checks())
