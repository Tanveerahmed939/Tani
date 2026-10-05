// Xtream + M3U client. All server traffic goes through the backend
// proxy (/api/proxy/*) so Expo web preview doesn't trip CORS and so
// the server UA is a media-player UA (some IPTV hosts gate by UA).

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export type XtreamCreds = { server: string; username: string; password: string };

export type Channel = {
  stream_id: number;
  name: string;
  num?: number;
  stream_icon?: string;
  category_id?: string;
  epg_channel_id?: string;
  tv_archive?: number;
  stream_type?: "live";
};
export type VodItem = {
  stream_id: number;
  name: string;
  stream_icon?: string;
  category_id?: string;
  rating?: string;
  year?: string;
  container_extension?: string;
  added?: string;
};
export type SeriesItem = {
  series_id: number;
  name: string;
  cover?: string;
  category_id?: string;
  releaseDate?: string;
  rating?: string;
  plot?: string;
  cast?: string;
  genre?: string;
};
export type Category = { category_id: string; category_name: string; parent_id?: number };

function cleanServer(s: string) {
  let v = s.trim();
  if (!/^https?:\/\//i.test(v)) v = "http://" + v;
  return v.replace(/\/+$/, "");
}

async function xtreamCall(creds: XtreamCreds, params: Record<string, string | undefined>) {
  const url = new URL(`${BACKEND}/api/proxy/xtream`);
  url.searchParams.set("server", cleanServer(creds.server));
  url.searchParams.set("username", creds.username);
  url.searchParams.set("password", creds.password);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b?.detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function xtreamAuth(creds: XtreamCreds) {
  const data = await xtreamCall(creds, {});
  if (!data || data.user_info?.auth !== 1) {
    throw new Error(data?.user_info?.message || "Invalid Xtream credentials");
  }
  return data;
}

export const xtream = {
  liveCategories: (c: XtreamCreds) => xtreamCall(c, { action: "get_live_categories" }) as Promise<Category[]>,
  liveStreams: (c: XtreamCreds, categoryId?: string) =>
    xtreamCall(c, { action: "get_live_streams", category_id: categoryId }) as Promise<Channel[]>,
  vodCategories: (c: XtreamCreds) => xtreamCall(c, { action: "get_vod_categories" }) as Promise<Category[]>,
  vodStreams: (c: XtreamCreds, categoryId?: string) =>
    xtreamCall(c, { action: "get_vod_streams", category_id: categoryId }) as Promise<VodItem[]>,
  vodInfo: (c: XtreamCreds, vodId: number) => xtreamCall(c, { action: "get_vod_info", vod_id: String(vodId) }),
  seriesCategories: (c: XtreamCreds) => xtreamCall(c, { action: "get_series_categories" }) as Promise<Category[]>,
  seriesList: (c: XtreamCreds, categoryId?: string) =>
    xtreamCall(c, { action: "get_series", category_id: categoryId }) as Promise<SeriesItem[]>,
  seriesInfo: (c: XtreamCreds, seriesId: number) =>
    xtreamCall(c, { action: "get_series_info", series_id: String(seriesId) }),
};

export function buildStreamUrl(
  creds: XtreamCreds,
  kind: "live" | "movie" | "series",
  streamId: number | string,
  container?: string
): string {
  const s = cleanServer(creds.server);
  if (kind === "live") return `${s}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
  if (kind === "movie") return `${s}/movie/${creds.username}/${creds.password}/${streamId}.${container || "mp4"}`;
  return `${s}/series/${creds.username}/${creds.password}/${streamId}.${container || "mkv"}`;
}

// ------------- M3U playlist support -------------

export type M3UChannel = {
  id: string;
  name: string;
  logo?: string;
  group?: string;
  url: string;
  tvgId?: string;
};

export async function fetchM3U(url: string): Promise<M3UChannel[]> {
  const proxy = `${BACKEND}/api/proxy/text?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxy);
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b?.detail || detail; } catch {}
    throw new Error(detail);
  }
  const text = await res.text();
  return parseM3U(text);
}

export function parseM3U(text: string): M3UChannel[] {
  const lines = text.split(/\r?\n/);
  const out: M3UChannel[] = [];
  let pending: Partial<M3UChannel> | null = null;
  let idx = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      // #EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="News",Channel Name
      const tvgId = /tvg-id="([^"]*)"/i.exec(line)?.[1];
      const logo = /tvg-logo="([^"]*)"/i.exec(line)?.[1];
      const group = /group-title="([^"]*)"/i.exec(line)?.[1];
      const name = line.split(",").slice(1).join(",").trim() || "Channel";
      pending = { id: `${idx++}`, name, tvgId, logo, group };
    } else if (!line.startsWith("#")) {
      if (pending) {
        out.push({ ...(pending as M3UChannel), url: line });
        pending = null;
      }
    }
  }
  return out;
}

// Normalize an M3U channel into a "fake" Xtream Channel so the rest of the UI
// (which was built around the Xtream shape) can render it uniformly.
export function m3uToChannel(ch: M3UChannel, i: number): Channel & { direct_url: string } {
  return {
    stream_id: i,
    name: ch.name,
    stream_icon: ch.logo,
    category_id: ch.group || "default",
    direct_url: ch.url,
  };
}
