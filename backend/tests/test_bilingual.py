"""
Iteration 5 tests — bilingual (English + Arabic) support for the WhatsApp
simulator (POST /api/whatsapp/message) and the real Meta webhook path
(POST /api/whatsapp/webhook -> run_bot_for_whatsapp).
"""
import hmac
import hashlib
import json
import time
import asyncio
import pytest
import requests

FAKE_APP_SECRET = "shhh"  # Same fake secret configured by test_whatsapp_integration


def _sig(raw: bytes) -> str:
    return "sha256=" + hmac.new(FAKE_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()


# ---------- Restaurant name reflects the new seeded value ----------

class TestRestaurantName:
    def test_settings_restaurant_name_is_kanoon(self, api_client, base_url, auth_headers):
        # Reset to the seeded name in case previous suite modified it
        api_client.patch(f"{base_url}/api/settings",
                         json={"restaurant_name": "Kanoon Al Kebab"},
                         headers=auth_headers, timeout=15)
        r = api_client.get(f"{base_url}/api/settings", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["restaurant_name"] == "Kanoon Al Kebab"


# ---------- Simulator /api/whatsapp/message: English greetings ----------

class TestSimulatorEnglish:
    # NOTE: We do NOT reset settings.restaurant_name here — other parallel tests
    # (test_auth_register creating owners, test_settings_get_update) mutate the
    # shared row and any reset from us would race them. Instead we assert on the
    # language-marker "Welcome to *" which uniquely identifies the English
    # branch. The exact "Kanoon Al Kebab" text is asserted separately in
    # TestRestaurantName (which owns settings reset at the start of the module).

    @pytest.mark.parametrize("msg", ["Hi", "menu", "hello", "hey"])
    def test_english_greet_returns_welcome_and_menu(self, api_client, base_url, msg):
        r = api_client.post(f"{base_url}/api/whatsapp/message",
                            json={"message": msg,
                                  "customer_name": "TEST_EN",
                                  "customer_phone": "+15550000101"},
                            timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["lang"] == "en", f"lang should be 'en' for '{msg}', got {data.get('lang')}"
        texts = " ".join(rep["text"] for rep in data["replies"])
        # Language-only marker (restaurant name may be mutated by parallel register tests)
        assert "Welcome to *" in texts, f"missing English welcome: {texts}"
        assert "I'll help you place an order" in texts, f"missing English body: {texts}"
        assert "Here's our menu" in texts, f"missing English menu prompt: {texts}"


# ---------- Simulator /api/whatsapp/message: Arabic greetings ----------

class TestSimulatorArabic:
    @pytest.mark.parametrize("msg", ["مرحبا", "منيو", "القائمة", "السلام عليكم", "أهلا"])
    def test_arabic_greet_returns_arabic_welcome_and_menu(self, api_client, base_url, msg):
        r = api_client.post(f"{base_url}/api/whatsapp/message",
                            json={"message": msg,
                                  "customer_name": "TEST_AR",
                                  "customer_phone": "+15550000201"},
                            timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["lang"] == "ar", f"lang should be 'ar' for '{msg}', got {data.get('lang')}"
        texts = " ".join(rep["text"] for rep in data["replies"])
        assert "أهلاً بك" in texts, f"missing Arabic welcome: {texts}"
        assert "إليك قائمتنا" in texts, f"missing Arabic menu prompt: {texts}"
        assert "Welcome to" not in texts, f"Arabic path should not include English welcome: {texts}"


# ---------- Full Arabic order flow ----------

class TestArabicOrderFlow:
    def test_full_arabic_order_flow(self, api_client, base_url, auth_headers):
        # Greet in Arabic
        r = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "message": "مرحبا",
            "customer_name": "TEST_Layla",
            "customer_phone": "+15550000301",
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        sid = d["session_id"]
        assert d["lang"] == "ar"
        menu_reply = next((rep for rep in d["replies"]
                          if rep["payload"].get("type") == "menu_list"), None)
        assert menu_reply is not None
        items = menu_reply["payload"]["items"]
        assert len(items) >= 1
        item_id = items[0]["id"]

        # Add — no language cue → session should remain Arabic
        r2 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": f"add:{item_id}"
        }, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["lang"] == "ar", "language stickiness broken on add:"
        add_text = " ".join(rep["text"] for rep in d2["replies"])
        assert "تم إضافة" in add_text, f"missing Arabic added text: {add_text}"

        # Checkout in Arabic
        r3 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": "طلب"
        }, timeout=15)
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["state"] == "awaiting_confirm"
        assert d3["lang"] == "ar"
        summary_text = " ".join(rep["text"] for rep in d3["replies"])
        assert "ملخص الطلب" in summary_text
        assert "الإجمالي" in summary_text

        # Confirm in Arabic
        r4 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": "نعم"
        }, timeout=30)
        assert r4.status_code == 200
        d4 = r4.json()
        assert d4["state"] == "completed"
        assert d4["lang"] == "ar"
        receipt = next((rep for rep in d4["replies"]
                        if rep["payload"].get("type") == "receipt"), None)
        assert receipt is not None, "expected receipt payload"
        assert "تم تأكيد طلبك" in receipt["text"], \
            f"receipt text must contain Arabic confirmed: {receipt['text']}"
        assert receipt["payload"].get("lang") == "ar"

        # whatsapp_dispatch present with both customer + owner keys
        wa = receipt["payload"].get("whatsapp_dispatch")
        assert wa is not None
        assert "customer" in wa and "owner" in wa

        # Order persisted with status='pending'
        r5 = api_client.get(f"{base_url}/api/orders", headers=auth_headers, timeout=15)
        order_id = receipt["payload"]["order"]["id"]
        orders = r5.json()
        matched = next((o for o in orders if o["id"] == order_id), None)
        assert matched is not None, "arabic order not persisted"
        assert matched["status"] == "pending"


# ---------- Language stickiness (session remembers 'ar') ----------

class TestLangStickiness:
    def test_add_after_arabic_greet_stays_arabic(self, api_client, base_url):
        # First greet in Arabic
        r = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "message": "مرحبا",
            "customer_name": "TEST_Sticky",
            "customer_phone": "+15550000401",
        }, timeout=15)
        assert r.status_code == 200
        d = r.json()
        sid = d["session_id"]
        assert d["lang"] == "ar"
        menu_reply = next((rep for rep in d["replies"]
                          if rep["payload"].get("type") == "menu_list"), None)
        item_id = menu_reply["payload"]["items"][0]["id"]

        # Send add:<id> which has no language cue — must still reply in Arabic
        r2 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": f"add:{item_id}"
        }, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["lang"] == "ar", "stickiness broken — expected ar"
        text = " ".join(rep["text"] for rep in d2["replies"])
        assert "تم إضافة" in text


# ---------- Full English order flow regression ----------

class TestEnglishOrderFlow:
    def test_full_english_order_flow(self, api_client, base_url, auth_headers):
        r = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "message": "Hi",
            "customer_name": "TEST_EN_Full",
            "customer_phone": "+15550000501",
        }, timeout=15)
        assert r.status_code == 200
        d = r.json()
        sid = d["session_id"]
        assert d["lang"] == "en"
        menu = next((rep for rep in d["replies"]
                     if rep["payload"].get("type") == "menu_list"), None)
        item_id = menu["payload"]["items"][0]["id"]

        r2 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": f"add:{item_id}"
        }, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["lang"] == "en"

        r3 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": "checkout"
        }, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["state"] == "awaiting_confirm"

        r4 = api_client.post(f"{base_url}/api/whatsapp/message", json={
            "session_id": sid, "message": "yes"
        }, timeout=30)
        assert r4.status_code == 200
        d4 = r4.json()
        assert d4["state"] == "completed"
        receipt = next((rep for rep in d4["replies"]
                        if rep["payload"].get("type") == "receipt"), None)
        assert receipt is not None
        assert "Order confirmed" in receipt["text"]
        wa = receipt["payload"].get("whatsapp_dispatch")
        assert wa is not None
        assert "customer" in wa and "owner" in wa


# ---------- Real Meta webhook path: language detection persists to chat_sessions ----------

class TestWebhookBilingual:
    def _post_webhook(self, base_url, text_body, from_num, mid_suffix):
        raw_obj = {
            "entry": [{
                "changes": [{
                    "value": {
                        "contacts": [{"profile": {"name": "TestUser"}}],
                        "messages": [{
                            "id": f"wamid.iter5-{mid_suffix}-{int(time.time()*1000)}",
                            "from": from_num,
                            "type": "text",
                            "text": {"body": text_body},
                        }],
                    }
                }]
            }]
        }
        raw = json.dumps(raw_obj).encode()
        return requests.post(
            f"{base_url}/api/whatsapp/webhook",
            data=raw,
            headers={"X-Hub-Signature-256": _sig(raw), "Content-Type": "application/json"},
            timeout=30,
        )

    def _fetch_session_lang(self, from_num):
        """Read chat_sessions doc directly from Mongo to verify persisted lang."""
        from motor.motor_asyncio import AsyncIOMotorClient
        from dotenv import load_dotenv
        from pathlib import Path
        import os
        load_dotenv(Path("/app/backend/.env"))
        cli = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = cli[os.environ["DB_NAME"]]

        async def _run():
            return await db.chat_sessions.find_one(
                {"wa_customer_phone": from_num}, {"_id": 0}
            )
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()
            cli.close()

    def test_webhook_english_inbound_creates_en_session(self, api_client, base_url, auth_headers):
        from_num = "15559990001"
        r = self._post_webhook(base_url, "Hi", from_num, "en")
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

        sess = self._fetch_session_lang(from_num)
        assert sess is not None, "chat_sessions doc should exist"
        assert sess.get("lang") == "en", f"expected lang='en', got {sess}"

    def test_webhook_arabic_inbound_creates_ar_session(self, base_url):
        from_num = "15559990002"
        r = self._post_webhook(base_url, "مرحبا", from_num, "ar")
        assert r.status_code == 200, r.text
        sess = self._fetch_session_lang(from_num)
        assert sess is not None
        assert sess.get("lang") == "ar", f"expected lang='ar', got {sess}"

    def test_webhook_bad_signature_still_403(self, base_url):
        body = json.dumps({"entry": []}).encode()
        r = requests.post(
            f"{base_url}/api/whatsapp/webhook",
            data=body,
            headers={"X-Hub-Signature-256": "sha256=deadbeef", "Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 403

    def test_webhook_verify_challenge(self, api_client, base_url, auth_headers):
        r = api_client.get(f"{base_url}/api/settings/whatsapp",
                           headers=auth_headers, timeout=15)
        vt = r.json()["verify_token"]
        r2 = requests.get(
            f"{base_url}/api/whatsapp/webhook",
            params={"hub.mode": "subscribe", "hub.verify_token": vt, "hub.challenge": "abc"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.text == "abc"
