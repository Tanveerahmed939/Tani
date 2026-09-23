import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiLogin, apiMe, apiRegister, clearToken, getToken } from "./api";

type User = { id: string; email: string; name: string; role: string } | null;

type Ctx = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, restaurantName: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) { setUser(null); return; }
      const u = await apiMe();
      setUser(u as any);
    } catch {
      setUser(null);
      await clearToken();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await apiLogin(email, password);
    setUser(u);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, restaurantName: string) => {
    const u = await apiRegister(email, password, name, restaurantName);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
