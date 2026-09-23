from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
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

@api_router.get("/settings")
async def get_settings(user: dict = Depends(current_user)):
    s = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Settings missing")
    return s

@api_router.patch("/settings")
async def update_settings(body: SettingsUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await db.settings.find_one_and_update({"id": "default"}, {"$set": updates}, return_document=True, projection={"_id": 0})
    if not res:
        raise HTTPException(404, "Settings missing")
    return res

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

    session = await get_or_create_session(body.session_id, body.customer_name, body.customer_phone)
    text = body.message.strip()
    lower = text.lower()

    session["messages"].append(new_user_msg(text))

    replies: List[dict] = []
    state = session["state"]

    async def send_menu():
        items = await db.menu_items.find({"available": True}, {"_id": 0}).sort("created_at", 1).to_list(100)
        replies.append(new_bot_msg(
            f"Here's our menu at *{settings['restaurant_name']}* 🍽️\nTap an item to add it to your cart.",
            {"type": "menu_list", "items": items}
        ))
        session["state"] = "browsing"

    # Greeting triggers menu regardless of state
    if lower in {"hi", "hello", "hey", "menu", "start"} or state == "idle":
        replies.append(new_bot_msg(
            f"👋 Welcome to *{settings['restaurant_name']}*! I'll help you place an order."
        ))
        await send_menu()
    elif lower.startswith("add:"):
        # format: add:<menu_item_id>
        item_id = text.split(":", 1)[1].strip()
        item = await db.menu_items.find_one({"id": item_id, "available": True}, {"_id": 0})
        if not item:
            replies.append(new_bot_msg("Sorry, that item isn't available."))
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
                f"✅ Added *{item['name']}* to your cart.\n\nYour cart so far:\n" +
                "\n".join(summary["lines"]) +
                f"\n\nSubtotal: {currency}{summary['subtotal']:.2f}\nTax: {currency}{summary['tax']:.2f}\n*Total: {currency}{summary['total']:.2f}*\n\nReply *checkout* to place the order or tap another item to add more.",
                {"type": "cart_update", "cart": session["cart"], **summary}
            ))
            session["state"] = "browsing"
    elif lower in {"checkout", "confirm", "yes", "place order"}:
        if not session["cart"]:
            replies.append(new_bot_msg("Your cart is empty. Reply *menu* to see what's available."))
        elif state != "awaiting_confirm":
            summary = cart_summary(session["cart"], tax_rate, currency)
            replies.append(new_bot_msg(
                "📋 *Order Summary*\n\n" +
                "\n".join(summary["lines"]) +
                f"\n\nSubtotal: {currency}{summary['subtotal']:.2f}\nTax: {currency}{summary['tax']:.2f}\n*Total: {currency}{summary['total']:.2f}*\n\nReply *yes* to confirm or *cancel* to abandon.",
                {"type": "checkout", **summary}
            ))
            session["state"] = "awaiting_confirm"
        else:
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
                "created_at": now,
                "updated_at": now,
            }
            await db.orders.insert_one(dict(order_doc))
            replies.append(new_bot_msg(
                f"🎉 Order confirmed! Your order *#{order_id[:8].upper()}* has been sent to the kitchen.\n\nTotal: *{currency}{summary['total']:.2f}*\n\nWe'll notify you once it's ready. Thank you! 🙏",
                {"type": "receipt", "order": {**order_doc, "_id": None}, "restaurant_phone": settings.get("restaurant_phone", "")}
            ))
            session["state"] = "completed"
            session["cart"] = []
    elif lower in {"cancel", "no"}:
        session["cart"] = []
        session["state"] = "browsing"
        replies.append(new_bot_msg("No worries, your cart has been cleared. Reply *menu* to browse again."))
    else:
        replies.append(new_bot_msg("I didn't catch that. Reply *menu* to see the menu, *checkout* to place your order, or *cancel* to reset."))

    for r in replies:
        session["messages"].append(r)
    await save_session(session)

    return {
        "session_id": session["id"],
        "state": session["state"],
        "cart": session["cart"],
        "replies": replies,
    }

@api_router.post("/whatsapp/reset")
async def whatsapp_reset():
    return {"ok": True}

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
