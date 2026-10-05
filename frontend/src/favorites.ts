import { storage } from "@/src/utils/storage";

const FAV_KEY = "streamx_favorites_v1";

export type FavKind = "live" | "movie" | "series";
export type FavItem = {
  key: string;      // "live:123"
  kind: FavKind;
  id: string | number;
  name: string;
  icon?: string;
};

async function readAll(): Promise<FavItem[]> {
  const raw = await storage.getItem(FAV_KEY, null);
  if (!raw) return [];
  try {
    const list = JSON.parse(String(raw));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}
async function writeAll(items: FavItem[]) { await storage.setItem(FAV_KEY, JSON.stringify(items)); }

export const favorites = {
  async list(): Promise<FavItem[]> { return readAll(); },
  async toggle(item: Omit<FavItem, "key">): Promise<boolean> {
    const key = `${item.kind}:${item.id}`;
    const all = await readAll();
    const existing = all.findIndex(x => x.key === key);
    if (existing >= 0) {
      all.splice(existing, 1);
      await writeAll(all);
      return false;
    }
    all.unshift({ ...item, key });
    await writeAll(all.slice(0, 500));
    return true;
  },
  async has(kind: FavKind, id: string | number) {
    const all = await readAll();
    return all.some(x => x.key === `${kind}:${id}`);
  },
};
