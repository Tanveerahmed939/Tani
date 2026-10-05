import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage } from "@/src/utils/storage";
import { Channel, M3UChannel, XtreamCreds, fetchM3U, m3uToChannel, xtreamAuth } from "./iptv";

export type Session =
  | { mode: "xtream"; creds: XtreamCreds; userInfo: any; serverInfo: any }
  | { mode: "m3u"; url: string; channels: (Channel & { direct_url: string })[]; raw: M3UChannel[] };

type Ctx = {
  session: Session | null;
  loading: boolean;
  loginXtream: (creds: XtreamCreds, remember: boolean) => Promise<void>;
  loginM3U: (url: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
};

const KEY = "streamx_session_v1";

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const raw = await storage.secureGet(KEY, null);
      if (raw) {
        const parsed = JSON.parse(String(raw));
        setSession(parsed);
      }
    } catch {}
    setLoading(false);
  })(); }, []);

  const loginXtream = useCallback(async (creds: XtreamCreds, remember: boolean) => {
    const info = await xtreamAuth(creds);
    const next: Session = { mode: "xtream", creds, userInfo: info?.user_info || {}, serverInfo: info?.server_info || {} };
    setSession(next);
    if (remember) await storage.secureSet(KEY, JSON.stringify(next));
    else await storage.secureRemove(KEY);
  }, []);

  const loginM3U = useCallback(async (url: string, remember: boolean) => {
    const raw = await fetchM3U(url);
    if (!raw.length) throw new Error("No channels found in playlist");
    const channels = raw.map((c, i) => m3uToChannel(c, i));
    const next: Session = { mode: "m3u", url, channels, raw };
    setSession(next);
    if (remember) await storage.secureSet(KEY, JSON.stringify(next));
    else await storage.secureRemove(KEY);
  }, []);

  const logout = useCallback(async () => {
    setSession(null);
    await storage.secureRemove(KEY);
  }, []);

  const value = useMemo(() => ({ session, loading, loginXtream, loginM3U, logout }), [session, loading, loginXtream, loginM3U, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
