"""
Tests for the new /api/auth/register endpoint and login regressions.
Bug fix 1 (frontend error handling depends on backend validation format).
Feature 2 (Signup).
"""
import time
import pytest


# ---- Register: happy path + duplicate + validation ----

def test_register_success_returns_token_and_user(api_client, base_url):
    email = f"pw+{int(time.time()*1000)}@example.com"
    payload = {
        "email": email,
        "password": "pizza123",
        "name": "PW Owner",
        "restaurant_name": "Playwright Pizzeria",
    }
    r = api_client.post(f"{base_url}/api/auth/register", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data and data["access_token"]
    assert data["user"]["email"] == email
    assert data["user"]["name"] == "PW Owner"
    assert data["user"]["role"] == "owner"
    assert "id" in data["user"]

    # Newly created user should be able to log in with same creds
    r2 = api_client.post(f"{base_url}/api/auth/login",
                         json={"email": email, "password": "pizza123"})
    assert r2.status_code == 200, r2.text
    assert r2.json()["user"]["email"] == email

    # /api/settings must reflect the new restaurant name (shared settings)
    token = data["access_token"]
    r3 = api_client.get(f"{base_url}/api/settings",
                        headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
    assert r3.json()["restaurant_name"] == "Playwright Pizzeria"


def test_register_duplicate_email_returns_409(api_client, base_url):
    email = f"pw+dup{int(time.time()*1000)}@example.com"
    payload = {
        "email": email, "password": "pizza123", "name": "Dup",
        "restaurant_name": "Dup Diner",
    }
    r1 = api_client.post(f"{base_url}/api/auth/register", json=payload)
    assert r1.status_code == 201, r1.text

    r2 = api_client.post(f"{base_url}/api/auth/register", json=payload)
    assert r2.status_code == 409, r2.text
    detail = r2.json().get("detail")
    assert isinstance(detail, str)
    assert "already exists" in detail.lower()


def test_register_invalid_email_returns_422_with_detail_array(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/register", json={
        "email": "notanemail", "password": "pizza123",
        "name": "X", "restaurant_name": "Y",
    })
    assert r.status_code == 422, r.text
    body = r.json()
    # Pydantic v2 returns an array of errors under detail
    assert "detail" in body
    assert isinstance(body["detail"], list) and len(body["detail"]) >= 1
    first = body["detail"][0]
    assert "msg" in first
    # Frontend flattens msgs → containing "email" keyword confirms readability
    combined = " ".join(d.get("msg", "") for d in body["detail"]).lower()
    assert "email" in combined


def test_register_short_password_returns_422(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/register", json={
        "email": f"pw+short{int(time.time()*1000)}@example.com",
        "password": "abc", "name": "X", "restaurant_name": "Y",
    })
    assert r.status_code == 422, r.text
    assert isinstance(r.json()["detail"], list)


# ---- Login regressions ----

def test_login_wrong_password_returns_401_string_detail(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"email": "owner@restaurant.com", "password": "wrongpass"})
    assert r.status_code == 401
    detail = r.json().get("detail")
    assert isinstance(detail, str)
    assert "invalid" in detail.lower()


def test_login_invalid_email_returns_422(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"email": "notanemail", "password": "anything"})
    assert r.status_code == 422
    body = r.json()
    assert isinstance(body["detail"], list)
    assert any("email" in (d.get("msg", "") or "").lower() for d in body["detail"])


# ---- Regression: new signup user can drive the WhatsApp flow ----

def test_new_signup_user_can_use_whatsapp_flow(api_client, base_url):
    email = f"pw+wa{int(time.time()*1000)}@example.com"
    reg = api_client.post(f"{base_url}/api/auth/register", json={
        "email": email, "password": "pizza123",
        "name": "PW WA", "restaurant_name": "Playwright Pizzeria WA",
    })
    assert reg.status_code == 201

    # Say "Hi" — bot should return a menu regardless of who is logged in
    r = api_client.post(f"{base_url}/api/whatsapp/message", json={"message": "Hi"})
    assert r.status_code == 200
    body = r.json()
    session_id = body["session_id"]
    menu_reply = next((rp for rp in body["replies"] if rp.get("payload", {}).get("type") == "menu_list"), None)
    assert menu_reply is not None
    items = menu_reply["payload"]["items"]
    assert len(items) >= 1
    first_item = items[0]

    # Add → checkout → confirm
    r2 = api_client.post(f"{base_url}/api/whatsapp/message",
                         json={"session_id": session_id, "message": f"add:{first_item['id']}"})
    assert r2.status_code == 200
    r3 = api_client.post(f"{base_url}/api/whatsapp/message",
                         json={"session_id": session_id, "message": "checkout"})
    assert r3.status_code == 200
    r4 = api_client.post(f"{base_url}/api/whatsapp/message",
                         json={"session_id": session_id, "message": "yes"})
    assert r4.status_code == 200
    receipt = next((rp for rp in r4.json()["replies"] if rp.get("payload", {}).get("type") == "receipt"), None)
    assert receipt is not None, "Expected receipt payload after confirmation"
    assert "order" in receipt["payload"]
