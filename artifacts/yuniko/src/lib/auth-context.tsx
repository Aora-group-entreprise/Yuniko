import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ensureProfile, getCurrentUser, signIn, signUp, toAuthUser, updateProfile as saveProfile, type Profile } from "@/lib/supabase-auth";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  country: string | null;
  countryFlag: string | null;
  age: number | null;
  bio: string;
  email: string | null;
  location: string | null;
  website: string | null;
  coverPhoto: string | null;
  verified: boolean;
  followers: number;
  following: number;
  posts: number;
  createdAt: string;
}

interface RegisterInput { username: string; password: string; displayName: string; country: string; countryFlag: string; age: number; avatarUrl: string | null; }
interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (patch: Partial<Profile>) => Promise<AuthUser>;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "yuniko_supabase_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = (accessToken: string, profile: Profile) => {
    const authUser = toAuthUser(profile);
    setToken(accessToken);
    setUser(authUser);
    localStorage.setItem(TOKEN_KEY, accessToken);
    return authUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
  };

  const refreshProfile = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) { logout(); return; }
    try {
      setIsLoading(true);
      const auth = await getCurrentUser(storedToken);
      const profile = await ensureProfile({ access_token: storedToken, user: auth }, { username: auth.email?.split("@")[0] ?? `user_${auth.id.slice(0, 8)}`, email: auth.email ?? null });
      applySession(storedToken, profile);
      setError(null);
    } catch (err) {
      logout();
      setError(err instanceof Error ? err.message : "Session expired");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refreshProfile(); }, []);

  const login = async (username: string, password: string) => {
    setError(null);
    const { session, profile } = await signIn(username, password);
    return applySession(session.access_token, profile);
  };

  const register = async (input: RegisterInput) => {
    setError(null);
    const { session, profile } = await signUp(input);
    return applySession(session.access_token, profile);
  };

  const updateUser = async (patch: Partial<Profile>) => {
    if (!user || !token) throw new Error("You must be signed in to update your profile.");
    const profile = await saveProfile(user.id, token, patch);
    return applySession(token, profile);
  };

  return <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, refreshProfile, isLoading, error }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
