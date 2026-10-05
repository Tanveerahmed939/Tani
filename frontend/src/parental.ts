import { storage } from "@/src/utils/storage";

const PIN_KEY = "streamx_parental_pin_v1";
const LOCKED_KEY = "streamx_parental_locked_v1";
const UNLOCKED_KEY = "streamx_parental_unlocked_until_v1";

const AUTO_LOCK_WORDS = ["adult", "xxx", "18+", "porn", "erotic", "+18", "sex"];
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;

export const parental = {
  async getPin(): Promise<string | null> { return storage.secureGet(PIN_KEY, null) as Promise<string | null>; },
  async setPin(pin: string): Promise<void> { await storage.secureSet(PIN_KEY, pin); },
  async clearPin(): Promise<void> { await storage.secureRemove(PIN_KEY); },

  async isPinSet(): Promise<boolean> {
    const p = await storage.secureGet(PIN_KEY, null);
    return !!p;
  },

  async verify(pin: string): Promise<boolean> {
    const current = await storage.secureGet(PIN_KEY, null);
    if (!current) return true;
    return String(current) === pin;
  },

  async getLockedCategories(): Promise<string[]> {
    const raw = await storage.getItem(LOCKED_KEY, null);
    if (!raw) return [];
    try {
      const list = JSON.parse(String(raw));
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  },
  async setLockedCategories(ids: string[]): Promise<void> {
    await storage.setItem(LOCKED_KEY, JSON.stringify(Array.from(new Set(ids))));
  },

  autoLockMatches(name: string): boolean {
    const low = (name || "").toLowerCase();
    return AUTO_LOCK_WORDS.some(w => low.includes(w));
  },

  async isCategoryLocked(id: string, name?: string): Promise<boolean> {
    if (!(await this.isPinSet())) return false;
    const list = await this.getLockedCategories();
    if (list.includes(String(id))) return true;
    if (name && this.autoLockMatches(name)) return true;
    return false;
  },

  async markUnlocked(): Promise<void> {
    await storage.setItem(UNLOCKED_KEY, String(Date.now() + UNLOCK_WINDOW_MS));
  },
  async isSessionUnlocked(): Promise<boolean> {
    const until = await storage.getItem(UNLOCKED_KEY, null);
    if (!until) return false;
    return Number(until) > Date.now();
  },
};
