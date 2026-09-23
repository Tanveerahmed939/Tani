# WhatsOrder POS — Product Requirements

## Vision
A mobile app for restaurant owners to receive & manage orders that arrive via WhatsApp Business. Customers say "Hi" on WhatsApp, browse the menu, checkout, and confirm — the owner instantly receives the order receipt in-app.

## Users
- Restaurant owner (single-user, seeded account)

## Feature Set (MVP)
1. **Auth** — email/password (JWT), owner seeded on startup
2. **Dashboard** — revenue today, orders today, pending, active, recent orders
3. **Live Orders** — Active / Past segmented view, tap into detail
4. **Order Detail** — customer info, itemized receipt, status transition (accept → preparing → ready → delivered), reject option
5. **Menu Management** — CRUD (name, description, price, category, image URL, availability switch)
6. **WhatsApp Simulator** — WhatsApp-styled chat that mimics customer flow (say "Hi" → menu bubble → list bottom sheet → add items → cart update → checkout → confirm → receipt card). Creates a real order in DB.
7. **Restaurant Settings** — name, WhatsApp number, tax rate, currency symbol
8. **Logout**

## Tech
- **Backend**: FastAPI + Motor (MongoDB), bcrypt + PyJWT auth, UUID string IDs
- **Frontend**: Expo (React Native), expo-router, expo-secure-store, expo-image, Ionicons
- **Design**: Warm terracotta/ochre food-app theme (single source of truth in `src/theme.ts`)

## Out of scope for MVP (deferred)
- Real Twilio / Meta WhatsApp Cloud API webhook (currently the flow is simulated in-app; wiring in a provider is a follow-up)
- Menu item image upload via Object Storage (currently URL string)
- Multi-user / multi-restaurant support
- Push notifications

## Seeded Data
- 1 Owner: `owner@restaurant.com` / `owner12345`
- Restaurant "Emergent Diner" with 6 menu items across Burgers / Pizza / Salads / Sides / Drinks
