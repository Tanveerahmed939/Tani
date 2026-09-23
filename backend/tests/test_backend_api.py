"""
End-to-end backend tests for WhatsOrder POS API.
Covers: auth, menu CRUD, whatsapp bot flow, orders, dashboard, settings.
"""
import pytest


# ---------------- Health & Auth ----------------

def test_health(api_client, base_url):
    r = api_client.get(f"{base_url}/api/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_login_success(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"email": "owner@restaurant.com", "password": "owner12345"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == "owner@restaurant.com"
    assert data["user"]["role"] == "owner"


def test_login_bad_password(api_client, base_url):
    r = api_client.post(f"{base_url}/api/auth/login",
                        json={"email": "owner@restaurant.com", "password": "wrong"})
    assert r.status_code == 401


def test_me_with_token(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "owner@restaurant.com"
    assert body["role"] == "owner"
    assert "id" in body


def test_me_without_token(api_client, base_url):
    r = api_client.get(f"{base_url}/api/auth/me")
    assert r.status_code == 401


# ---------------- Menu ----------------

def test_menu_list_public(api_client, base_url):
    r = api_client.get(f"{base_url}/api/menu")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 6, f"expected >=6 seeded items, got {len(items)}"
    for it in items:
        assert "_id" not in it
        for key in ("id", "name", "price", "category", "available"):
            assert key in it


def test_menu_create_requires_auth(api_client, base_url):
    r = api_client.post(f"{base_url}/api/menu",
                        json={"name": "TEST_Unauth", "price": 10})
    assert r.status_code == 401


def test_menu_crud_full_cycle(api_client, base_url, auth_headers):
    # Create
    payload = {"name": "TEST_Iced Tea", "description": "Cold brew", "price": 99.0,
               "category": "Drinks", "image_url": "", "available": True}
    r = api_client.post(f"{base_url}/api/menu", json=payload, headers=auth_headers)
    assert r.status_code == 200, r.text
    created = r.json()
    item_id = created["id"]
    assert created["name"] == "TEST_Iced Tea"
    assert "_id" not in created

    # GET verify persistence
    r2 = api_client.get(f"{base_url}/api/menu")
    assert any(i["id"] == item_id for i in r2.json())

    # PATCH toggle availability
    r3 = api_client.patch(f"{base_url}/api/menu/{item_id}",
                          json={"available": False}, headers=auth_headers)
    assert r3.status_code == 200
    assert r3.json()["available"] is False

    # Verify persisted toggle
    r4 = api_client.get(f"{base_url}/api/menu")
    updated = next(i for i in r4.json() if i["id"] == item_id)
    assert updated["available"] is False

    # DELETE
    r5 = api_client.delete(f"{base_url}/api/menu/{item_id}", headers=auth_headers)
    assert r5.status_code == 200
    r6 = api_client.get(f"{base_url}/api/menu")
    assert not any(i["id"] == item_id for i in r6.json())


def test_menu_patch_404(api_client, base_url, auth_headers):
    r = api_client.patch(f"{base_url}/api/menu/nonexistent-id",
                         json={"available": False}, headers=auth_headers)
    assert r.status_code == 404


# ---------------- WhatsApp Bot Flow ----------------

class TestWhatsappFlow:
    """Complete customer journey: Hi -> add -> checkout -> yes -> order."""

    def test_full_order_flow(self, api_client, base_url, auth_headers):
        # Step 1: Send Hi -> menu
        r = api_client.post(f"{base_url}/api/whatsapp/message",
                            json={"message": "Hi", "customer_name": "TEST_Aarav",
                                  "customer_phone": "+91 99999 00000"})
        assert r.status_code == 200, r.text
        d = r.json()
        session_id = d["session_id"]
        assert d["state"] == "browsing"
        menu_payload = next((rep["payload"] for rep in d["replies"]
                             if rep["payload"].get("type") == "menu_list"), None)
        assert menu_payload is not None
        items = menu_payload["items"]
        assert len(items) >= 3
        first_item_id = items[0]["id"]
        first_item_price = items[0]["price"]

        # Step 2: Add item
        r2 = api_client.post(f"{base_url}/api/whatsapp/message",
                             json={"session_id": session_id,
                                   "message": f"add:{first_item_id}"})
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["state"] == "browsing"
        assert len(d2["cart"]) == 1
        assert d2["cart"][0]["menu_item_id"] == first_item_id
        assert d2["cart"][0]["quantity"] == 1

        # Add same item again -> qty 2
        r2b = api_client.post(f"{base_url}/api/whatsapp/message",
                              json={"session_id": session_id,
                                    "message": f"add:{first_item_id}"})
        assert r2b.json()["cart"][0]["quantity"] == 2

        # Step 3: checkout -> awaiting_confirm
        r3 = api_client.post(f"{base_url}/api/whatsapp/message",
                             json={"session_id": session_id, "message": "checkout"})
        d3 = r3.json()
        assert d3["state"] == "awaiting_confirm"

        # Step 4: yes -> order created
        r4 = api_client.post(f"{base_url}/api/whatsapp/message",
                             json={"session_id": session_id, "message": "yes"})
        d4 = r4.json()
        assert d4["state"] == "completed"
        receipt_payload = next((rep["payload"] for rep in d4["replies"]
                                if rep["payload"].get("type") == "receipt"), None)
        assert receipt_payload is not None
        order = receipt_payload["order"]
        order_id = order["id"]
        assert order["total"] > 0
        assert order["subtotal"] == first_item_price * 2

        # Verify order persisted (auth required)
        r5 = api_client.get(f"{base_url}/api/orders", headers=auth_headers)
        assert r5.status_code == 200
        assert any(o["id"] == order_id for o in r5.json())

        # Store for other tests via return
        return order_id

    def test_orders_require_auth(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/orders")
        assert r.status_code == 401

    def test_order_status_transitions(self, api_client, base_url, auth_headers):
        # Create an order via whatsapp flow first
        order_id = self.test_full_order_flow(api_client, base_url, auth_headers)

        for status in ["accepted", "preparing", "ready", "delivered"]:
            r = api_client.patch(f"{base_url}/api/orders/{order_id}/status",
                                 json={"status": status}, headers=auth_headers)
            assert r.status_code == 200, r.text
            assert r.json()["status"] == status

        # Verify persistence
        r2 = api_client.get(f"{base_url}/api/orders/{order_id}", headers=auth_headers)
        assert r2.json()["status"] == "delivered"


# ---------------- Dashboard ----------------

def test_dashboard_stats(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/dashboard/stats", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    for key in ("revenue_today", "orders_today", "active_orders",
                "pending_orders", "total_orders"):
        assert key in d
        assert isinstance(d[key], (int, float))


def test_dashboard_requires_auth(api_client, base_url):
    r = api_client.get(f"{base_url}/api/dashboard/stats")
    assert r.status_code == 401


# ---------------- Settings ----------------

def test_settings_get_update(api_client, base_url, auth_headers):
    r = api_client.get(f"{base_url}/api/settings", headers=auth_headers)
    assert r.status_code == 200
    original = r.json()
    assert "restaurant_name" in original
    assert "restaurant_phone" in original

    new_name = original["restaurant_name"] + " (TEST)"
    r2 = api_client.patch(f"{base_url}/api/settings",
                          json={"restaurant_name": new_name}, headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["restaurant_name"] == new_name

    # Verify
    r3 = api_client.get(f"{base_url}/api/settings", headers=auth_headers)
    assert r3.json()["restaurant_name"] == new_name

    # Restore
    api_client.patch(f"{base_url}/api/settings",
                     json={"restaurant_name": original["restaurant_name"]},
                     headers=auth_headers)
