from fastapi import FastAPI, APIRouter, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os, logging, httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

app = FastAPI(title="StreamX IPTV API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("streamx")

HEADERS = {"User-Agent": "VLC/3.0.20 LibVLC/3.0.20"}
TIMEOUT = httpx.Timeout(15.0, connect=10.0)


def _validate_url(u: str) -> str:
    if not u:
        raise HTTPException(400, "url required")
    low = u.lower()
    if not (low.startswith("http://") or low.startswith("https://")):
        raise HTTPException(400, "url must be http/https")
    return u


@api_router.get("/health")
async def health():
    return {"ok": True, "service": "streamx"}


@api_router.get("/proxy/text")
async def proxy_text(url: str = Query(...)):
    """Fetch a remote text resource (e.g. an M3U playlist) and return it as
    text. Lets the mobile app bypass CORS while running inside Expo web
    preview, and uses a VLC UA because some IPTV servers only serve to
    media clients."""
    url = _validate_url(url)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as c:
            r = await c.get(url)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"fetch failed: {e}")
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"upstream {r.status_code}")
    content_type = r.headers.get("content-type", "application/x-mpegURL")
    return Response(content=r.text, media_type=content_type)


@api_router.get("/proxy/xtream")
async def proxy_xtream(
    server: str = Query(...),
    username: str = Query(...),
    password: str = Query(...),
    action: str | None = Query(None),
    category_id: str | None = Query(None),
    vod_id: str | None = Query(None),
    series_id: str | None = Query(None),
):
    """Thin passthrough to {server}/player_api.php for the Xtream Codes API.
    Returns the upstream JSON. Server-side so CORS never bites the UI."""
    server = _validate_url(server).rstrip("/")
    params = {"username": username, "password": password}
    if action:
        params["action"] = action
    if category_id:
        params["category_id"] = category_id
    if vod_id:
        params["vod_id"] = vod_id
    if series_id:
        params["series_id"] = series_id
    url = f"{server}/player_api.php"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers=HEADERS, follow_redirects=True) as c:
            r = await c.get(url, params=params)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"xtream fetch failed: {e}")
    if r.status_code >= 400:
        raise HTTPException(r.status_code, f"xtream upstream {r.status_code}")
    # Many Xtream servers return JSON with content-type text/html — force JSON parse.
    try:
        return r.json()
    except ValueError:
        return {"raw": r.text}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
