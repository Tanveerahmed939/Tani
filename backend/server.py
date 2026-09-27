from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import hmac
import hashlib
import secrets
import json
import httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', '1440'))

app = FastAPI(title="WhatsOrder POS API")
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------ Utility ------------

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False

def make_token(user_id: str, role: str) -> str:
    now = utcnow()
    payload = {"sub": user_id, "role": role, "iat": now, "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    unauthorized = HTTPException(status_code=401, detail="Invalid or missing token")
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        uid = payload.get("sub")
    except jwt.PyJWTError:
        raise unauthorized
    user = await db.users.find_one({"id": uid, "is_active": True}, {"_id": 0})
    if not user:
        raise unauthorized
    return user

# ------------ Models ------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    restaurant_name: str = Field(min_length=1, max_length=100)

class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

class MenuItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = ""
    price: float = Field(ge=0)
    category: str = "Main"
    image_url: str = ""
    available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    available: Optional[bool] = None

class MenuItem(MenuItemCreate):
    id: str
    created_at: str

class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: float
    quantity: int

OrderStatus = Literal["pending", "accepted", "preparing", "ready", "delivered", "cancelled"]

class OrderStatusUpdate(BaseModel):
    status: OrderStatus

class Order(BaseModel):
    id: str
    customer_name: str
    customer_phone: str
    items: List[OrderItem]
    subtotal: float
    tax: float
    total: float
    status: OrderStatus
    source: str = "whatsapp"
    created_at: str
    updated_at: str

class SettingsModel(BaseModel):
    restaurant_name: str
    restaurant_phone: str
    tax_rate: float = 0.05
    currency_symbol: str = "₹"

class SettingsUpdate(BaseModel):
    restaurant_name: Optional[str] = None
    restaurant_phone: Optional[str] = None
    tax_rate: Optional[float] = None
    currency_symbol: Optional[str] = None
    whatsapp_enabled: Optional[bool] = None
    whatsapp_access_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_app_secret: Optional[str] = None
    whatsapp_verify_token: Optional[str] = None
    owner_whatsapp_number: Optional[str] = None

class WhatsAppMessageRequest(BaseModel):
    session_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    message: str

# ------------ Auth ------------

@api_router.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    email = body.email.strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, "An account with that email already exists")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name.strip(),
        "role": "owner",
        "hashed_password": hash_password(body.password),
        "restaurant_name": body.restaurant_name.strip(),
        "is_active": True,
        "created_at": iso(utcnow()),
    }
    await db.users.insert_one(dict(doc))
    # Update the shared restaurant settings with this owner's restaurant name
    await db.settings.update_one(
        {"id": "default"},
        {"$set": {"restaurant_name": body.restaurant_name.strip()}},
        upsert=False,
    )
    pub = UserPublic(id=user_id, email=email, name=doc["name"], role=doc["role"])
    return TokenResponse(access_token=make_token(user_id, doc["role"]), user=pub)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(403, "Account is disabled")
    pub = UserPublic(id=user["id"], email=user["email"], name=user["name"], role=user["role"])
    return TokenResponse(access_token=make_token(user["id"], user["role"]), user=pub)

@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)):
    return UserPublic(id=user["id"], email=user["email"], name=user["name"], role=user["role"])

# ------------ Menu ------------

def clean_doc(d: dict) -> dict:
    d.pop("_id", None)
    return d

@api_router.get("/menu")
async def list_menu():
    items = await db.menu_items.find({}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return items

@api_router.post("/menu")
async def create_menu_item(body: MenuItemCreate, user: dict = Depends(current_user)):
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = iso(utcnow())
    await db.menu_items.insert_one(doc)
    return clean_doc(doc)

@api_router.patch("/menu/{item_id}")
async def update_menu_item(item_id: str, body: MenuItemUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.menu_items.find_one_and_update({"id": item_id}, {"$set": updates}, return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(404, "Menu item not found")
    return res

@api_router.delete("/menu/{item_id}")
async def delete_menu_item(item_id: str, user: dict = Depends(current_user)):
    res = await db.menu_items.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Menu item not found")
    return {"ok": True}

# ------------ Orders ------------

@api_router.get("/orders")
async def list_orders(user: dict = Depends(current_user)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    return order

@api_router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, user: dict = Depends(current_user)):
    res = await db.orders.find_one_and_update(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": iso(utcnow())}},
        return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Order not found")
    return res

# ------------ Dashboard ------------

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(current_user)):
    now = utcnow()
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    all_orders = await db.orders.find({}, {"_id": 0}).to_list(5000)
    today_orders = [o for o in all_orders if o.get("created_at", "") >= start_of_day]
    active_statuses = {"pending", "accepted", "preparing", "ready"}
    active = [o for o in all_orders if o.get("status") in active_statuses]
    pending = [o for o in all_orders if o.get("status") == "pending"]
    revenue_today = sum(o.get("total", 0) for o in today_orders if o.get("status") != "cancelled")
    return {
        "revenue_today": round(revenue_today, 2),
        "orders_today": len(today_orders),
        "active_orders": len(active),
        "pending_orders": len(pending),
        "total_orders": len(all_orders),
    }

# ------------ Settings ------------

SENSITIVE_FIELDS = {"whatsapp_access_token", "whatsapp_app_secret"}

def mask_secret(v: Optional[str]) -> str:
    if not v: return ""
    if len(v) <= 6: return "•" * len(v)
    return v[:3] + "•" * max(3, len(v) - 6) + v[-3:]

def sanitize_settings(s: dict) -> dict:
    out = {k: v for k, v in s.items() if k != "_id"}
    for k in SENSITIVE_FIELDS:
        if out.get(k):
            out[k + "_masked"] = mask_secret(out[k])
            out[k + "_set"] = True
        else:
            out[k + "_set"] = False
        out.pop(k, None)  # never return raw secret to client
    return out

@api_router.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    s = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Settings missing")
    return sanitize_settings(s)

@api_router.patch("/settings")
async def update_settings(body: SettingsUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")

    # Auto-generate a strong verify_token the first time WhatsApp gets configured
    if any(k.startswith("whatsapp_") for k in updates) or "owner_whatsapp_number" in updates:
        current = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
        if not current.get("whatsapp_verify_token") and "whatsapp_verify_token" not in updates:
            updates["whatsapp_verify_token"] = secrets.token_urlsafe(24)

    res = await db.settings.find_one_and_update(
        {"id": "default"}, {"$set": updates},
        return_document=True, projection={"_id": 0}
    )
    if not res:
        raise HTTPException(404, "Settings missing")
    return sanitize_settings(res)

@api_router.get("/settings/whatsapp")
async def get_whatsapp_settings(request: Request, user: dict = Depends(current_user)):
    """Return the info needed to configure Meta's webhook (verify_token + URL)."""
    s = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    # Prefer explicit PUBLIC_BASE_URL from env (set to the app's public HTTPS host).
    # Fall back to X-Forwarded-Proto/Host when the platform sets them, and finally
    # request.base_url as a last resort (works locally but often internal in k8s).
    base = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    if not base:
        proto = request.headers.get("x-forwarded-proto", "https")
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        if host:
            base = f"{proto}://{host}"
        else:
            base = str(request.base_url).rstrip("/")
    return {
        "webhook_url": f"{base}/api/whatsapp/webhook",
        "verify_token": s.get("whatsapp_verify_token", ""),
        "whatsapp_enabled": bool(s.get("whatsapp_enabled", False)),
        "phone_number_id": s.get("whatsapp_phone_number_id", ""),
        "owner_whatsapp_number": s.get("owner_whatsapp_number", ""),
        "access_token_set": bool(s.get("whatsapp_access_token")),
        "app_secret_set": bool(s.get("whatsapp_app_secret")),
    }

# ------------ Meta WhatsApp Cloud API sender ------------

GRAPH_VERSION = "v25.0"
GRAPH_BASE = "https://graph.facebook.com"

def normalize_wa_number(num: str) -> str:
    """Meta expects the international number WITHOUT '+' or spaces."""
    if not num: return ""
    return "".join(ch for ch in num if ch.isdigit())

# ------------ Bilingual helpers (English / Arabic) ------------

def detect_lang(text: str) -> str:
    """Return 'ar' if the text contains Arabic characters, 'en' if it contains
    Latin letters but no Arabic, or '' when the message carries no linguistic
    signal (digits, emoji, punctuation, or technical tokens like 'add:<uuid>').

    Callers use '' as "no evidence — keep the session's existing language"."""
    if not text:
        return ""
    has_arabic = False
    has_latin = False
    for ch in text:
        cp = ord(ch)
        if (0x0600 <= cp <= 0x06FF) or (0x0750 <= cp <= 0x077F) or (0xFB50 <= cp <= 0xFDFF) or (0xFE70 <= cp <= 0xFEFF):
            has_arabic = True
        elif ('a' <= ch <= 'z') or ('A' <= ch <= 'Z'):
            has_latin = True
    if has_arabic:
        return "ar"
    if has_latin:
        return "en"
    return ""

# Keyword sets — lowercase for English, raw for Arabic
GREET_EN = {"hi", "hello", "hey", "menu", "start", "hola"}
GREET_AR = {"مرحبا", "مرحباً", "أهلا", "أهلاً", "اهلا", "اهلاً", "السلام عليكم", "السلام", "هاي", "منيو", "المنيو", "قائمة", "القائمة", "قائمة الطعام", "ابدأ", "ابدا"}
CHECKOUT_EN = {"checkout", "place order", "order"}
CHECKOUT_AR = {"طلب", "اطلب", "اطلبها", "الدفع", "ادفع", "أدفع", "checkout"}
CONFIRM_EN = {"yes", "confirm", "y"}
CONFIRM_AR = {"نعم", "أكد", "اكد", "أوافق", "اوافق", "موافق", "تأكيد", "تاكيد", "أيوه", "ايوه"}
CANCEL_EN = {"cancel", "no", "n"}
CANCEL_AR = {"لا", "الغاء", "إلغاء", "الغِ", "لا شكرا", "لا شكراً"}

def is_greet(lower: str, lang: str) -> bool:
    return (lower in GREET_EN) or (lower in GREET_AR)

def is_checkout(lower: str, lang: str) -> bool:
    return (lower in CHECKOUT_EN) or (lower in CHECKOUT_AR)

def is_confirm(lower: str, lang: str) -> bool:
    return (lower in CONFIRM_EN) or (lower in CONFIRM_AR)

def is_cancel(lower: str, lang: str) -> bool:
    return (lower in CANCEL_EN) or (lower in CANCEL_AR)

def t_welcome(lang: str, restaurant_name: str) -> str:
    if lang == "ar":
        return f"👋 أهلاً بك في *{restaurant_name}*! سأساعدك في إتمام طلبك."
    return f"👋 Welcome to *{restaurant_name}*! I'll help you place an order."

def t_menu_prompt(lang: str) -> tuple:
    """Returns (header_text, body_text, button_text, section_title, footer_text) for the interactive list."""
    if lang == "ar":
        return ("قائمتنا", "اضغط على 'عرض القائمة' لاختيار الأصناف.", "عرض القائمة", "الأصناف المتوفرة", "أرسل 'طلب' لإتمام الطلب")
    return ("Our menu", "Tap 'View menu' to pick items.", "View menu", "Available", "Reply CHECKOUT to place order")

def t_item_unavailable(lang: str) -> str:
    return "عذراً، هذا الصنف غير متاح." if lang == "ar" else "Sorry, that item isn't available."

def t_cart_added(lang: str, item_name: str, summary: dict, currency: str) -> str:
    if lang == "ar":
        return (
            f"✅ تم إضافة *{item_name}* إلى سلتك.\n\n"
            + "\n".join(summary["lines"]) +
            f"\n\nالمجموع الفرعي: {currency}{summary['subtotal']:.2f}"
            f"\nالضريبة: {currency}{summary['tax']:.2f}"
            f"\n*الإجمالي: {currency}{summary['total']:.2f}*"
            "\n\nأرسل *طلب* لإتمام الطلب أو *منيو* لإضافة المزيد."
        )
    return (
        f"✅ Added *{item_name}* to your cart.\n\n"
        + "\n".join(summary["lines"]) +
        f"\n\nSubtotal: {currency}{summary['subtotal']:.2f}"
        f"\nTax: {currency}{summary['tax']:.2f}"
        f"\n*Total: {currency}{summary['total']:.2f}*"
        "\n\nReply *checkout* to place the order or MENU to add more."
    )

def t_cart_empty(lang: str) -> str:
    return "سلتك فارغة. أرسل *منيو* لعرض الأصناف المتوفرة." if lang == "ar" else "Your cart is empty. Reply MENU to see what's available."

def t_order_summary(lang: str, summary: dict, currency: str) -> str:
    if lang == "ar":
        return (
            "📋 *ملخص الطلب*\n\n" +
            "\n".join(summary["lines"]) +
            f"\n\nالمجموع الفرعي: {currency}{summary['subtotal']:.2f}"
            f"\nالضريبة: {currency}{summary['tax']:.2f}"
            f"\n*الإجمالي: {currency}{summary['total']:.2f}*"
            "\n\nأرسل *نعم* للتأكيد أو *لا* للإلغاء."
        )
    return (
        "📋 *Order Summary*\n\n" +
        "\n".join(summary["lines"]) +
        f"\n\nSubtotal: {currency}{summary['subtotal']:.2f}"
        f"\nTax: {currency}{summary['tax']:.2f}"
        f"\n*Total: {currency}{summary['total']:.2f}*"
        "\n\nReply *yes* to confirm or *cancel* to abandon."
    )

def t_cancelled(lang: str) -> str:
    return "لا مشكلة، تم إفراغ سلتك. أرسل *منيو* لاستعراض القائمة مرة أخرى." if lang == "ar" else "No worries, your cart has been cleared. Reply MENU to browse again."

def t_fallback(lang: str) -> str:
    return "لم أفهم رسالتك. أرسل *منيو* لعرض القائمة، *طلب* لإتمام الطلب، أو *لا* لإعادة البدء." if lang == "ar" else "I didn't catch that. Reply MENU to see the menu, CHECKOUT to place your order, or CANCEL to reset."

async def send_whatsapp(to: str, payload: dict) -> dict:
    """Send an arbitrary WhatsApp Cloud API payload. Falls back to simulator log if creds missing."""
    to = normalize_wa_number(to)
    s = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    token = s.get("whatsapp_access_token")
    phone_id = s.get("whatsapp_phone_number_id")
    enabled = s.get("whatsapp_enabled", False)
    if not enabled or not token or not phone_id or not to:
        logger.warning(f"[WA simulator] would send to {to}: {json.dumps(payload)[:200]}")
        return {"delivered": False, "simulator": True}
    url = f"{GRAPH_BASE}/{GRAPH_VERSION}/{phone_id}/messages"
    try:
        async with httpx.AsyncClient(timeout=15) as hc:
            r = await hc.post(url, headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }, json={"messaging_product": "whatsapp", "recipient_type": "individual", "to": to, **payload})
        if r.is_error:
            logger.error(f"[WA send FAIL {r.status_code}] {r.text[:300]}")
            return {"delivered": False, "status": r.status_code, "error": r.text[:300]}
        return {"delivered": True, "meta": r.json()}
    except httpx.HTTPError as e:
        logger.error(f"[WA HTTP error] {e}")
        return {"delivered": False, "error": "network"}

async def send_wa_text(to: str, body: str) -> dict:
    return await send_whatsapp(to, {"type": "text", "text": {"preview_url": False, "body": body}})

async def send_wa_menu_list(to: str, items: List[dict], restaurant_name: str, currency: str, lang: str = "en") -> dict:
    header_text, body_text, button_text, section_title, footer_text = t_menu_prompt(lang)
    rows = []
    for it in items[:10]:  # Meta limit: 10 rows
        rows.append({
            "id": str(it["id"]),
            "title": str(it["name"])[:24],
            "description": f"{currency}{float(it['price']):.2f}"[:72],
        })
    return await send_whatsapp(to, {
        "type": "interactive",
        "interactive": {
            "type": "list",
            "header": {"type": "text", "text": f"{restaurant_name} — {header_text}"[:60]},
            "body": {"text": body_text},
            "footer": {"text": footer_text[:60]},
            "action": {
                "button": button_text[:20],
                "sections": [{"title": section_title[:24], "rows": rows}],
            },
        },
    })

def render_receipt_text(order: dict, currency: str, restaurant_name: str, is_owner: bool = False, lang: str = "en") -> str:
    lines = [f"{it['quantity']}× {it['name']} — {currency}{it['price']*it['quantity']:.2f}" for it in order["items"]]
    if lang == "ar":
        head = "🧾 *طلب جديد!*" if is_owner else "🎉 *تم تأكيد طلبك!*"
        body = (
            f"{head}\n"
            f"{restaurant_name}\n"
            f"رقم الطلب #{order['id'][:8].upper()}\n\n"
            + "\n".join(lines) +
            f"\n\nالمجموع الفرعي: {currency}{order['subtotal']:.2f}"
            f"\nالضريبة: {currency}{order['tax']:.2f}"
            f"\n*الإجمالي: {currency}{order['total']:.2f}*"
        )
        if is_owner:
            body += f"\n\nالعميل: {order.get('customer_name','')}\nالهاتف: {order.get('customer_phone','')}"
        else:
            body += "\n\nشكراً لك! سنعلمك حالما يصبح الطلب جاهزاً."
        return body
    head = "🧾 *New order received!*" if is_owner else "🎉 *Order confirmed!*"
    body = (
        f"{head}\n"
        f"{restaurant_name}\n"
        f"Order #{order['id'][:8].upper()}\n\n"
        + "\n".join(lines) +
        f"\n\nSubtotal: {currency}{order['subtotal']:.2f}"
        f"\nTax: {currency}{order['tax']:.2f}"
        f"\n*Total: {currency}{order['total']:.2f}*"
    )
    if is_owner:
        body += f"\n\nCustomer: {order.get('customer_name','')}\nPhone: {order.get('customer_phone','')}"
    else:
        body += "\n\nThank you! We'll notify you when it's ready."
    return body

# ------------ WhatsApp Simulator (stateful bot) ------------
# State machine states: idle -> greeted -> browsing -> cart_review -> awaiting_confirm -> completed
# Each session keeps: id, customer_name, customer_phone, state, cart[], messages[]

def new_bot_msg(text: str, payload: Optional[dict] = None) -> dict:
    return {"id": str(uuid.uuid4()), "sender": "bot", "text": text, "payload": payload or {}, "created_at": iso(utcnow())}

def new_user_msg(text: str) -> dict:
    return {"id": str(uuid.uuid4()), "sender": "user", "text": text, "payload": {}, "created_at": iso(utcnow())}

async def get_or_create_session(session_id: Optional[str], customer_name: Optional[str], customer_phone: Optional[str]) -> dict:
    if session_id:
        s = await db.chat_sessions.find_one({"id": session_id}, {"_id": 0})
        if s:
            return s
    sid = str(uuid.uuid4())
    session = {
        "id": sid,
        "customer_name": customer_name or "Guest",
        "customer_phone": customer_phone or "",
        "state": "idle",
        "cart": [],
        "messages": [],
        "created_at": iso(utcnow()),
    }
    await db.chat_sessions.insert_one(dict(session))
    return session

async def save_session(session: dict):
    await db.chat_sessions.update_one({"id": session["id"]}, {"$set": {
        "customer_name": session["customer_name"],
        "customer_phone": session["customer_phone"],
        "state": session["state"],
        "cart": session["cart"],
        "messages": session["messages"],
        "lang": session.get("lang", "en"),
    }})

def cart_summary(cart: List[dict], tax_rate: float, currency: str) -> dict:
    subtotal = sum(i["price"] * i["quantity"] for i in cart)
    tax = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax, 2)
    lines = [f"• {i['quantity']}× {i['name']} — {currency}{i['price'] * i['quantity']:.2f}" for i in cart]
    return {"subtotal": round(subtotal, 2), "tax": tax, "total": total, "lines": lines}

@api_router.post("/whatsapp/message")
async def whatsapp_message(body: WhatsAppMessageRequest):
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {"restaurant_name": "Restaurant", "tax_rate": 0.05, "currency_symbol": "₹", "restaurant_phone": ""}
    currency = settings.get("currency_symbol", "₹")
    tax_rate = float(settings.get("tax_rate", 0.05))
    restaurant_name = settings.get("restaurant_name", "Restaurant")

    session = await get_or_create_session(body.session_id, body.customer_name, body.customer_phone)
    text = body.message.strip()
    lower = text.lower()

    # Detect language from the incoming message and only update the session's
    # stored lang when the message carries a clear signal (Arabic chars OR a
    # recognised English keyword). Technical tokens like 'add:<uuid>' should
    # not silently reset an Arabic session back to English.
    detected = detect_lang(text)
    known_en = lower in GREET_EN | CHECKOUT_EN | CONFIRM_EN | CANCEL_EN
    if detected == "ar":
        session["lang"] = "ar"
    elif detected == "en" and known_en:
        session["lang"] = "en"
    lang = session.get("lang", "en")

    session["messages"].append(new_user_msg(text))

    replies: List[dict] = []
    state = session["state"]

    async def send_menu():
        items = await db.menu_items.find({"available": True}, {"_id": 0}).sort("created_at", 1).to_list(100)
        if lang == "ar":
            hdr = f"إليك قائمتنا في *{restaurant_name}* 🍽️\nاضغط على أي صنف لإضافته إلى السلة."
        else:
            hdr = f"Here's our menu at *{restaurant_name}* 🍽️\nTap an item to add it to your cart."
        replies.append(new_bot_msg(hdr, {"type": "menu_list", "items": items, "lang": lang}))
        session["state"] = "browsing"

    # Greeting triggers menu regardless of state
    if is_greet(lower, lang) or state == "idle":
        replies.append(new_bot_msg(t_welcome(lang, restaurant_name)))
        await send_menu()
    elif lower.startswith("add:"):
        # format: add:<menu_item_id>
        item_id = text.split(":", 1)[1].strip()
        item = await db.menu_items.find_one({"id": item_id, "available": True}, {"_id": 0})
        if not item:
            replies.append(new_bot_msg(t_item_unavailable(lang)))
        else:
            existing = next((c for c in session["cart"] if c["menu_item_id"] == item["id"]), None)
            if existing:
                existing["quantity"] += 1
            else:
                session["cart"].append({
                    "menu_item_id": item["id"],
                    "name": item["name"],
                    "price": float(item["price"]),
                    "quantity": 1,
                })
            summary = cart_summary(session["cart"], tax_rate, currency)
            replies.append(new_bot_msg(
                t_cart_added(lang, item["name"], summary, currency),
                {"type": "cart_update", "cart": session["cart"], "lang": lang, **summary}
            ))
            session["state"] = "browsing"
    elif is_checkout(lower, lang) or (is_confirm(lower, lang) and state != "awaiting_confirm"):
        if not session["cart"]:
            replies.append(new_bot_msg(t_cart_empty(lang)))
        else:
            summary = cart_summary(session["cart"], tax_rate, currency)
            replies.append(new_bot_msg(
                t_order_summary(lang, summary, currency),
                {"type": "checkout", "lang": lang, **summary}
            ))
            session["state"] = "awaiting_confirm"
    elif is_confirm(lower, lang) and state == "awaiting_confirm":
        # confirm and create order
        summary = cart_summary(session["cart"], tax_rate, currency)
        order_id = str(uuid.uuid4())
        now = iso(utcnow())
        order_doc = {
            "id": order_id,
            "customer_name": session["customer_name"],
            "customer_phone": session["customer_phone"],
            "items": session["cart"],
            "subtotal": summary["subtotal"],
            "tax": summary["tax"],
            "total": summary["total"],
            "status": "pending",
            "source": "whatsapp",
            "lang": lang,
            "created_at": now,
            "updated_at": now,
        }
        await db.orders.insert_one(dict(order_doc))
        if lang == "ar":
            confirm_text = (
                f"🎉 تم تأكيد طلبك! رقم الطلب *#{order_id[:8].upper()}* أُرسل إلى المطبخ.\n\n"
                f"الإجمالي: *{currency}{summary['total']:.2f}*\n\nسنعلمك حالما يكون جاهزاً. شكراً لك! 🙏"
            )
        else:
            confirm_text = (
                f"🎉 Order confirmed! Your order *#{order_id[:8].upper()}* has been sent to the kitchen.\n\n"
                f"Total: *{currency}{summary['total']:.2f}*\n\nWe'll notify you once it's ready. Thank you! 🙏"
            )
        replies.append(new_bot_msg(
            confirm_text,
            {"type": "receipt", "order": {**order_doc, "_id": None}, "restaurant_phone": settings.get("restaurant_phone", ""), "lang": lang}
        ))
        session["state"] = "completed"
        session["cart"] = []

        # 🔔 Auto-dispatch receipts over WhatsApp (real Meta send if configured, else logged)
        wa_result = await auto_send_receipts(order_doc, settings, customer_lang=lang, owner_lang="en")
        replies[-1]["payload"]["whatsapp_dispatch"] = wa_result
    elif is_cancel(lower, lang):
        session["cart"] = []
        session["state"] = "browsing"
        replies.append(new_bot_msg(t_cancelled(lang)))
    else:
        replies.append(new_bot_msg(t_fallback(lang)))

    for r in replies:
        session["messages"].append(r)
    await save_session(session)

    return {
        "session_id": session["id"],
        "state": session["state"],
        "cart": session["cart"],
        "lang": session.get("lang", "en"),
        "replies": replies,
    }

@api_router.post("/whatsapp/reset")
async def whatsapp_reset():
    return {"ok": True}

# ------------ Auto receipt dispatch ------------

async def auto_send_receipts(order_doc: dict, settings: dict, customer_lang: str = "en", owner_lang: str = "en") -> dict:
    """Fire-and-report the two automatic outbound WhatsApp receipts.

    - Customer receipt → order_doc.customer_phone (if any) in customer_lang
    - Restaurant owner receipt → settings.owner_whatsapp_number (if any) in owner_lang
    Returns a dict describing what happened for each recipient.
    """
    currency = settings.get("currency_symbol", "₹")
    restaurant_name = settings.get("restaurant_name", "Restaurant")
    customer_number = order_doc.get("customer_phone", "")
    owner_number = settings.get("owner_whatsapp_number", "")

    result = {"customer": None, "owner": None}
    if customer_number:
        text = render_receipt_text(order_doc, currency, restaurant_name, is_owner=False, lang=customer_lang)
        result["customer"] = await send_wa_text(customer_number, text)
    if owner_number:
        text = render_receipt_text(order_doc, currency, restaurant_name, is_owner=True, lang=owner_lang)
        result["owner"] = await send_wa_text(owner_number, text)
    return result

# ------------ Meta WhatsApp Webhook ------------

@api_router.get("/whatsapp/webhook")
async def whatsapp_webhook_verify(request: Request):
    """Meta hits this once during webhook setup with hub.mode=subscribe."""
    q = request.query_params
    s = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    expected = s.get("whatsapp_verify_token", "")
    mode = q.get("hub.mode")
    token = q.get("hub.verify_token", "")
    challenge = q.get("hub.challenge", "")
    if mode == "subscribe" and expected and hmac.compare_digest(token, expected):
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="verification failed")

@api_router.post("/whatsapp/webhook")
async def whatsapp_webhook_receive(request: Request):
    raw = await request.body()
    s = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    app_secret = s.get("whatsapp_app_secret")

    # If configured, verify X-Hub-Signature-256 against the raw body
    if app_secret:
        supplied = request.headers.get("x-hub-signature-256", "")
        expected = "sha256=" + hmac.new(app_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=403, detail="invalid signature")

    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid JSON")

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            contacts = value.get("contacts", [])
            for msg in value.get("messages", []):
                from_num = msg.get("from") or ""
                contact_name = ""
                if contacts:
                    contact_name = (contacts[0].get("profile", {}) or {}).get("name", "")

                user_text = ""
                mtype = msg.get("type")
                if mtype == "text":
                    user_text = (msg.get("text", {}) or {}).get("body", "")
                elif mtype == "interactive":
                    inter = msg.get("interactive", {}) or {}
                    if inter.get("type") == "list_reply":
                        rid = (inter.get("list_reply", {}) or {}).get("id", "")
                        user_text = f"add:{rid}" if rid else ""
                    elif inter.get("type") == "button_reply":
                        rid = (inter.get("button_reply", {}) or {}).get("id", "")
                        user_text = rid or ""
                if not user_text:
                    continue

                # Idempotency: skip if we've seen this exact message id already
                mid = msg.get("id")
                if mid and await db.wa_messages_seen.find_one({"id": mid}):
                    continue
                if mid:
                    await db.wa_messages_seen.insert_one({"id": mid, "at": iso(utcnow())})

                # Run the bot state machine for this customer
                await run_bot_for_whatsapp(from_num, contact_name, user_text)

    return {"ok": True}

async def run_bot_for_whatsapp(customer_phone: str, customer_name: str, user_text: str):
    """Bot state machine adapted to real WhatsApp: sends outbound Meta messages
    instead of returning replies to the app. Replies match the language of the
    incoming message (English or Arabic)."""
    if not customer_phone:
        return
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {"restaurant_name": "Restaurant", "tax_rate": 0.05, "currency_symbol": "₹"}
    currency = settings.get("currency_symbol", "₹")
    tax_rate = float(settings.get("tax_rate", 0.05))
    restaurant_name = settings.get("restaurant_name", "Restaurant")

    # Look up / create a chat session keyed by the customer's WhatsApp number
    sess = await db.chat_sessions.find_one({"wa_customer_phone": customer_phone}, {"_id": 0})
    if not sess:
        sess = {
            "id": str(uuid.uuid4()),
            "customer_name": customer_name or "Customer",
            "customer_phone": customer_phone,
            "wa_customer_phone": customer_phone,
            "state": "idle",
            "cart": [],
            "messages": [],
            "lang": "en",
            "created_at": iso(utcnow()),
        }
        await db.chat_sessions.insert_one(dict(sess))

    text = (user_text or "").strip()
    lower = text.lower()
    state = sess["state"]

    # Same language-stickiness rule as the in-app simulator.
    detected = detect_lang(text)
    known_en = lower in GREET_EN | CHECKOUT_EN | CONFIRM_EN | CANCEL_EN
    if detected == "ar":
        sess["lang"] = "ar"
    elif detected == "en" and known_en:
        sess["lang"] = "en"
    lang = sess.get("lang", "en")

    if is_greet(lower, lang) or state == "idle":
        await send_wa_text(customer_phone, t_welcome(lang, restaurant_name))
        items = await db.menu_items.find({"available": True}, {"_id": 0}).sort("created_at", 1).to_list(100)
        await send_wa_menu_list(customer_phone, items, restaurant_name, currency, lang=lang)
        sess["state"] = "browsing"

    elif lower.startswith("add:"):
        item_id = text.split(":", 1)[1].strip()
        item = await db.menu_items.find_one({"id": item_id, "available": True}, {"_id": 0})
        if not item:
            await send_wa_text(customer_phone, t_item_unavailable(lang))
        else:
            existing = next((c for c in sess["cart"] if c["menu_item_id"] == item["id"]), None)
            if existing:
                existing["quantity"] += 1
            else:
                sess["cart"].append({"menu_item_id": item["id"], "name": item["name"], "price": float(item["price"]), "quantity": 1})
            summary = cart_summary(sess["cart"], tax_rate, currency)
            await send_wa_text(customer_phone, t_cart_added(lang, item["name"], summary, currency))
            sess["state"] = "browsing"

    elif is_checkout(lower, lang):
        if not sess["cart"]:
            await send_wa_text(customer_phone, t_cart_empty(lang))
        elif state != "awaiting_confirm":
            summary = cart_summary(sess["cart"], tax_rate, currency)
            await send_wa_text(customer_phone, t_order_summary(lang, summary, currency))
            sess["state"] = "awaiting_confirm"
        else:
            # already awaiting_confirm and got another checkout — treat as confirm
            pass

    elif is_confirm(lower, lang) and state == "awaiting_confirm":
        summary = cart_summary(sess["cart"], tax_rate, currency)
        order_id = str(uuid.uuid4())
        now = iso(utcnow())
        order_doc = {
            "id": order_id,
            "customer_name": sess.get("customer_name") or customer_name or "Customer",
            "customer_phone": customer_phone,
            "items": sess["cart"],
            "subtotal": summary["subtotal"],
            "tax": summary["tax"],
            "total": summary["total"],
            "status": "pending",
            "source": "whatsapp",
            "lang": lang,
            "created_at": now,
            "updated_at": now,
        }
        await db.orders.insert_one(dict(order_doc))
        # 🔔 Auto-send both receipts (customer in their lang, owner in English)
        await auto_send_receipts(order_doc, settings, customer_lang=lang, owner_lang="en")
        sess["state"] = "completed"
        sess["cart"] = []

    elif is_cancel(lower, lang):
        sess["cart"] = []
        sess["state"] = "browsing"
        await send_wa_text(customer_phone, t_cancelled(lang))
    else:
        await send_wa_text(customer_phone, t_fallback(lang))

    await db.chat_sessions.update_one({"id": sess["id"]}, {"$set": {
        "customer_name": sess.get("customer_name"),
        "customer_phone": sess.get("customer_phone"),
        "wa_customer_phone": customer_phone,
        "state": sess["state"],
        "cart": sess["cart"],
        "lang": sess.get("lang", "en"),
    }})

@api_router.get("/health")
async def health():
    return {"ok": True}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------ Startup seed ------------

@app.on_event("startup")
async def startup_seed():
    # Owner user
    email = os.environ["OWNER_EMAIL"].strip().lower()
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": email,
            "name": os.environ["OWNER_NAME"],
            "role": "owner",
            "hashed_password": hash_password(os.environ["OWNER_PASSWORD"]),
            "is_active": True,
            "created_at": iso(utcnow()),
        })
        logger.info(f"Seeded owner user: {email}")

    # Settings
    if not await db.settings.find_one({"id": "default"}):
        await db.settings.insert_one({
            "id": "default",
            "restaurant_name": os.environ["RESTAURANT_NAME"],
            "restaurant_phone": os.environ["RESTAURANT_PHONE"],
            "tax_rate": 0.05,
            "currency_symbol": "₹",
            "whatsapp_enabled": False,
            "whatsapp_access_token": "",
            "whatsapp_phone_number_id": "",
            "whatsapp_app_secret": "",
            "whatsapp_verify_token": "",
            "owner_whatsapp_number": "",
        })
        logger.info("Seeded default settings")

    # Menu items
    if await db.menu_items.count_documents({}) == 0:
        base_time = utcnow()
        seed_items = [
            {"name": "Classic Cheeseburger", "description": "Juicy patty, cheddar, lettuce, tomato", "price": 249.0, "category": "Burgers", "image_url": "https://images.unsplash.com/photo-1603064752734-4c48eff53d05?w=600&q=80", "available": True},
            {"name": "Margherita Pizza", "description": "San Marzano tomato, mozzarella, basil", "price": 349.0, "category": "Pizza", "image_url": "https://images.unsplash.com/photo-1593504049359-74330189a345?w=600&q=80", "available": True},
            {"name": "Pepperoni Pizza", "description": "Spicy pepperoni & mozzarella", "price": 399.0, "category": "Pizza", "image_url": "https://images.unsplash.com/photo-1548369937-47519962c11a?w=600&q=80", "available": True},
            {"name": "Caesar Salad", "description": "Romaine, parmesan, croutons, caesar dressing", "price": 199.0, "category": "Salads", "image_url": "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=600&q=80", "available": True},
            {"name": "French Fries", "description": "Crispy golden fries with sea salt", "price": 129.0, "category": "Sides", "image_url": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&q=80", "available": True},
            {"name": "Chocolate Shake", "description": "Rich chocolate milkshake with cream", "price": 179.0, "category": "Drinks", "image_url": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&q=80", "available": True},
        ]
        for i, item in enumerate(seed_items):
            await db.menu_items.insert_one({
                **item,
                "id": str(uuid.uuid4()),
                "created_at": iso(base_time + timedelta(seconds=i)),
            })
        logger.info(f"Seeded {len(seed_items)} menu items")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
