import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "whatsorder_token";
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export const API_URL = API_BASE;

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    try { window.localStorage.setItem(KEY, token); } catch {}
  } else {
    await SecureStore.setItemAsync(KEY, token);
  }
}
export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return window.localStorage.getItem(KEY); } catch { return null; }
  }
  return SecureStore.getItemAsync(KEY);
}
export async function clearToken() {
  if (Platform.OS === "web") {
    try { window.localStorage.removeItem(KEY); } catch {}
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}

async function request<T = any>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const token = withAuth ? await getToken() : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as any;
  return res.json();
}

// ---- Auth ----
export async function apiLogin(email: string, password: string) {
  const data = await request<{ access_token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, false);
  await saveToken(data.access_token);
  return data.user;
}
export async function apiMe() {
  return request("/api/auth/me");
}

// ---- Menu ----
export async function apiListMenu(): Promise<any[]> {
  return request("/api/menu", {}, false);
}
export async function apiCreateMenu(body: any) {
  return request("/api/menu", { method: "POST", body: JSON.stringify(body) });
}
export async function apiUpdateMenu(id: string, body: any) {
  return request(`/api/menu/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
export async function apiDeleteMenu(id: string) {
  return request(`/api/menu/${id}`, { method: "DELETE" });
}

// ---- Orders ----
export async function apiListOrders() {
  return request<any[]>("/api/orders");
}
export async function apiGetOrder(id: string) {
  return request(`/api/orders/${id}`);
}
export async function apiUpdateOrderStatus(id: string, status: string) {
  return request(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

// ---- Dashboard ----
export async function apiDashboardStats() {
  return request("/api/dashboard/stats");
}

// ---- Settings ----
export async function apiGetSettings() {
  return request("/api/settings");
}
export async function apiUpdateSettings(body: any) {
  return request("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
}

// ---- WhatsApp Simulator ----
export async function apiSendWhatsappMessage(body: {
  session_id?: string;
  customer_name?: string;
  customer_phone?: string;
  message: string;
}) {
  return request("/api/whatsapp/message", { method: "POST", body: JSON.stringify(body) }, false);
}
