// Simple ad-gate cooldown. We don't integrate a real ad network here (no keys
// provided) — we use a short "sponsored" interstitial screen as a placeholder.
// Replace `AdGate` and `BannerAd` with AdMob components once you wire real IDs.
import { storage } from "@/src/utils/storage";

const LAST_WATCHED_KEY = "streamx_ads_last_watched_at_v1";
const COOLDOWN_MS = 60 * 1000; // 1 minute

export const ads = {
  async shouldShowAd(): Promise<boolean> {
    const raw = await storage.getItem(LAST_WATCHED_KEY, null);
    if (!raw) return true;
    const last = Number(raw);
    if (!last) return true;
    return Date.now() - last >= COOLDOWN_MS;
  },
  async markWatchedNow(): Promise<void> {
    await storage.setItem(LAST_WATCHED_KEY, String(Date.now()));
  },
  async getLastWatchedAt(): Promise<number> {
    const raw = await storage.getItem(LAST_WATCHED_KEY, null);
    return raw ? Number(raw) : 0;
  },
  cooldownMs: COOLDOWN_MS,
};
