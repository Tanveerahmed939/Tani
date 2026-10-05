import pytest
import requests
import os

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL/EXPO_BACKEND_URL not set in env")
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Accept": "*/*"})
    return s
