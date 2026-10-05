"""Backend tests for the StreamX IPTV FastAPI service.

Covers:
- /api/health
- /api/proxy/text  (M3U fetching + validation)
- /api/proxy/xtream (player_api.php passthrough + validation)
- Removal of all previous restaurant endpoints
"""
import pytest


# -------- /api/health --------
class TestHealth:
    def test_health_ok(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/health", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"ok": True, "service": "streamx"}


# -------- /api/proxy/text (M3U) --------
class TestProxyText:
    DEMO = "https://iptv-org.github.io/iptv/categories/news.m3u"

    def test_proxy_text_returns_m3u(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/proxy/text", params={"url": self.DEMO}, timeout=30)
        assert r.status_code == 200, r.text
        text = r.text
        assert text, "empty response"
        assert text.startswith("#EXTM3U") or "#EXTINF" in text, text[:200]

    def test_proxy_text_missing_url(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/proxy/text", timeout=15)
        # FastAPI returns 422 for missing required query, 400 is also acceptable
        assert r.status_code in (400, 422), r.text

    def test_proxy_text_non_http_scheme_is_rejected(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/proxy/text",
            params={"url": "javascript:alert(1)"},
            timeout=15,
        )
        assert r.status_code == 400, r.text


# -------- /api/proxy/xtream --------
class TestProxyXtream:
    def test_xtream_missing_params(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/proxy/xtream", timeout=15)
        assert r.status_code == 422, r.text

    def test_xtream_unreachable_upstream_returns_502(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/proxy/xtream",
            params={
                "server": "http://nonexistent.invalid.example",
                "username": "a",
                "password": "b",
            },
            timeout=30,
        )
        assert r.status_code == 502, f"expected 502 got {r.status_code}: {r.text[:200]}"


# -------- Legacy restaurant endpoints must be gone --------
class TestNoLegacyEndpoints:
    @pytest.mark.parametrize(
        "path",
        [
            "/api/auth/login",
            "/api/menu",
            "/api/orders",
            "/api/settings",
            "/api/whatsapp/message",
            "/api/whatsapp/webhook",
            "/api/whatsapp/send",
        ],
    )
    def test_legacy_endpoint_404(self, api_client, base_url, path):
        # Try GET and POST — the route should not exist in any method.
        r_get = api_client.get(f"{base_url}{path}", timeout=15)
        r_post = api_client.post(f"{base_url}{path}", json={}, timeout=15)
        # 404 preferred; 405 would still indicate the path exists which is a fail.
        assert r_get.status_code == 404, f"GET {path} returned {r_get.status_code}"
        assert r_post.status_code == 404, f"POST {path} returned {r_post.status_code}"
