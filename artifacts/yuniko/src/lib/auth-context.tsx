import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  countryFlag: string | null;
  age: number | null;
  bio: string;
  website: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: null;
  login: (user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const USER_KEY = "yuniko_user";
const LEGACY_TOKEN_KEY = "yuniko_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Remove the old client-readable token from previous Yuniko versions.
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  }, []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    void apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch("/auth/me");
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const freshUser = (await res.json()) as AuthUser;
        setUser(freshUser);
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
      }
    } catch {
      // Keep the cached user during temporary network failures.
    }
  }, [logout]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const res = await apiFetch("/auth/me");
        if (res.ok) {
          const freshUser = (await res.json()) as AuthUser;
          if (active) {
            setUser(freshUser);
            localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          }
        } else if (res.status === 401) {
          localStorage.removeItem(USER_KEY);
        } else {
          const cached = localStorage.getItem(USER_KEY);
          if (cached && active) {
            try { setUser(JSON.parse(cached) as AuthUser); } catch { localStorage.removeItem(USER_KEY); }
          }
        }
      } catch {
        const cached = localStorage.getItem(USER_KEY);
        if (cached && active) {
          try { setUser(JSON.parse(cached) as AuthUser); } catch { localStorage.removeItem(USER_KEY); }
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void restoreSession();
    return () => { active = false; };
  }, []);

  const login = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const updateUser = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  return (
    <AuthContext.Provider
      value={{ user, token: null, login, logout, updateUser, refreshUser, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
