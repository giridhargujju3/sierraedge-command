import { useLocation, useNavigate } from "@tanstack/react-router";
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppRole = "admin" | "user";

export interface AppUser {
  id: string;
  username: string;
  email?: string;
  name: string;
  role: AppRole;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  setUser: (user: AppUser | null) => void;
  logout: () => Promise<void>;
}

const AUTH_USER_KEY = "se_auth_user";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function readStoredUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppUser>;
    if (!parsed.id || !parsed.username || !parsed.role) return null;
    return {
      id: String(parsed.id),
      username: String(parsed.username),
      email: parsed.email ? String(parsed.email) : undefined,
      name: String(parsed.name ?? parsed.username),
      role: parsed.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export function writeStoredUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_USER_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    // storage may be unavailable
  }
}

export async function fetchCurrentUser(): Promise<AppUser | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; user?: AppUser } | null;
    if (!res.ok || !data?.ok || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function logoutCurrentSession() {
  writeStoredUser(null);
  if (typeof document !== "undefined") {
    document.cookie = "se_session=; Max-Age=0; Path=/; SameSite=Lax";
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    // ignore logout failures
  }
}

export function isAdminUser(user: AppUser | null): boolean {
  return user?.role === "admin";
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(() => !readStoredUser());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const storedUser = readStoredUser();
      if (storedUser) {
        setUserState(storedUser);
      }

      const sessionUser = await fetchCurrentUser();
      if (cancelled) return;

      if (sessionUser) {
        setUserState(sessionUser);
        writeStoredUser(sessionUser);
      } else {
        setUserState(null);
        writeStoredUser(null);
      }

      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (location.pathname === "/login") {
      if (user) {
        void navigate({ to: "/", replace: true });
      }
      return;
    }

    if (!user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [loading, location.pathname, navigate, user]);

  const setUser = (nextUser: AppUser | null) => {
    setUserState(nextUser);
    writeStoredUser(nextUser);
  };

  const logout = async () => {
    setUser(null);
    await logoutCurrentSession();
    await navigate({ to: "/login", replace: true });
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, setUser, logout }),
    [user, loading, logout],
  );

  if (location.pathname !== "/login" && loading) {
    return createElement(
      "div",
      {
        className: "flex min-h-screen items-center justify-center bg-background text-xs uppercase tracking-[0.26em] text-primary",
      },
      "AUTHENTICATING...",
    );
  }

  if (location.pathname !== "/login" && !loading && !user) {
    return null;
  }

  return createElement(AuthContext.Provider, { value }, children);
}
