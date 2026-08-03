import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  countryFlag: string | null;
  age: number | null;
  bio: string;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  refreshUser: () => Promise<AuthUser | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "yuniko_token";
const USER_KEY = "yuniko_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (!storedToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser) as AuthUser;
          if (!cancelled) {
            setToken(storedToken);
            setUser(parsed);
          }
        } catch {
          localStorage.removeItem(USER_KEY);
        }
      } else if (!cancelled) {
        setToken(storedToken);
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!response.ok) throw new Error("Stored session is no longer valid");

        const authenticatedUser = (await response.json()) as AuthUser;
        if (!cancelled) {
          setToken(storedToken);
          setUser(authenticatedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(authenticatedUser));
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const logout = () => {
    clearSession();
  };

  const updateUser = (u: AuthUser) => {
    setUser(u);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const refreshUser = async () => {
    const activeToken = token ?? localStorage.getItem(TOKEN_KEY);
    if (!activeToken) return null;

    const response = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const authenticatedUser = (await response.json()) as AuthUser;
    updateUser(authenticatedUser);
    return authenticatedUser;
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, updateUser, refreshUser, isLoading }}
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
