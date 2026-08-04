export interface Profile {
  id?: string | number;
  user_id: string;
  email: string | null;
  username: string;
  display_name: string;
  avatar_url: string | null;
  country: string | null;
  country_flag: string | null;
  age: number | null;
  bio: string;
  location: string | null;
  website: string | null;
  cover_photo: string | null;
  verified: boolean;
  followers: number;
  following: number;
  posts: number;
  created_at: string;
  updated_at?: string | null;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: { id: string; email?: string | null };
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function assertConfig() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

function authEmail(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@yuniko.local`;
}

async function supabaseFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  assertConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", SUPABASE_ANON_KEY!);
  headers.set("Authorization", `Bearer ${token ?? SUPABASE_ANON_KEY}`);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || "Supabase request failed";
    throw new Error(message);
  }
  return data as T;
}

export function toAuthUser(profile: Profile) {
  return {
    id: profile.user_id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url,
    country: profile.country,
    countryFlag: profile.country_flag,
    age: profile.age,
    bio: profile.bio || "",
    email: profile.email,
    location: profile.location,
    website: profile.website,
    coverPhoto: profile.cover_photo,
    verified: Boolean(profile.verified),
    followers: profile.followers ?? 0,
    following: profile.following ?? 0,
    posts: profile.posts ?? 0,
    createdAt: profile.created_at,
  };
}

export async function signIn(identifier: string, password: string) {
  const session = await supabaseFetch<AuthSession>("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: authEmail(identifier), password }),
  });
  const profile = await ensureProfile(session, { username: identifier, email: session.user.email ?? authEmail(identifier) });
  return { session, profile };
}

export async function signUp(input: { username: string; password: string; displayName: string; country: string; countryFlag: string; age: number; avatarUrl: string | null; }) {
  const email = authEmail(input.username);
  const session = await supabaseFetch<AuthSession>("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: input.password,
      data: { username: input.username, display_name: input.displayName, country: input.country, country_flag: input.countryFlag, age: input.age, avatar_url: input.avatarUrl },
    }),
  });
  const token = session.access_token;
  if (!token) throw new Error("Please confirm your email, then sign in.");
  const profile = await ensureProfile(session, { username: input.username, email, display_name: input.displayName, country: input.country, country_flag: input.countryFlag, age: input.age, avatar_url: input.avatarUrl });
  return { session, profile };
}

export async function getCurrentUser(token: string) {
  return supabaseFetch<{ id: string; email?: string | null }>("/auth/v1/user", {}, token);
}

export async function getProfile(userId: string, token: string) {
  const rows = await supabaseFetch<Profile[]>(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&limit=1`, {}, token);
  return rows[0] ?? null;
}

export async function getProfileByUsername(username: string) {
  const rows = await supabaseFetch<Profile[]>(`/rest/v1/profiles?username=eq.${encodeURIComponent(username.toLowerCase())}&limit=1`);
  return rows[0] ?? null;
}

export async function ensureProfile(session: AuthSession, seed: Partial<Profile> & { username: string; email?: string | null }) {
  const existing = await getProfile(session.user.id, session.access_token);
  if (existing) return existing;
  const now = new Date().toISOString();
  const profile: Profile = {
    user_id: session.user.id,
    email: seed.email ?? session.user.email ?? null,
    username: seed.username.toLowerCase(),
    display_name: seed.display_name || seed.username,
    avatar_url: seed.avatar_url ?? null,
    country: seed.country ?? null,
    country_flag: seed.country_flag ?? null,
    age: seed.age ?? null,
    bio: seed.bio ?? "",
    location: seed.location ?? seed.country ?? null,
    website: seed.website ?? null,
    cover_photo: seed.cover_photo ?? null,
    verified: false,
    followers: 0,
    following: 0,
    posts: 0,
    created_at: now,
  };
  const rows = await supabaseFetch<Profile[]>("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(profile),
  }, session.access_token);
  return rows[0] ?? (await getProfile(session.user.id, session.access_token))!;
}

export async function updateProfile(userId: string, token: string, patch: Partial<Profile>) {
  const rows = await supabaseFetch<Profile[]>(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  }, token);
  if (!rows[0]) throw new Error("Profile update failed");
  return rows[0];
}
