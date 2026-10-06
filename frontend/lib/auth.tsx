"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, TOKEN_KEY } from "./api";

export type User = { id: number; name: string; email: string; mobile: string; role: "BUYER" | "SUPPLIER" | "ADMIN" };
type Ctx = { user: User | null; loading: boolean; setSession: (t: string, u: User) => void; logout: () => void };
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setLoading(false); return; }
    api<User>("/api/auth/me").then(setUser).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setLoading(false));
  }, []);
  const setSession = (t: string, u: User) => { localStorage.setItem(TOKEN_KEY, t); setUser(u); };
  const logout = () => { localStorage.removeItem(TOKEN_KEY); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, setSession, logout }}>{children}</AuthCtx.Provider>;
}

export const homeFor = (role: User["role"]) => role === "ADMIN" ? "/admin/dashboard" : "/supplier/dashboard";
