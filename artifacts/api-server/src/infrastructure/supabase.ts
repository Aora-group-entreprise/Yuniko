export type SupabaseConfig = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
  mediaBucket: string;
  realtimeUrl: string;
};

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

/**
 * Supabase is Yuniko's infrastructure boundary. PostgreSQL remains the
 * source of truth and is accessed by Drizzle through DATABASE_URL.
 * Service-role credentials are server-only.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = clean(process.env.SUPABASE_URL).replace(/\/$/, "");
  const realtimeUrl = clean(process.env.SUPABASE_REALTIME_URL) ||
    (url ? `${url.replace(/^https?/, "wss")}/realtime/v1` : "");

  return {
    url,
    anonKey: clean(process.env.SUPABASE_ANON_KEY),
    serviceRoleKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    databaseUrl: clean(process.env.DATABASE_URL),
    mediaBucket: clean(process.env.SUPABASE_MEDIA_BUCKET) || "media",
    realtimeUrl,
  };
}

export function isSupabaseConfigured() {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.databaseUrl);
}

export function getSupabaseRealtimeUrl(channel?: string) {
  const { realtimeUrl, anonKey } = getSupabaseConfig();
  if (!realtimeUrl) return "";
  const suffix = channel ? `?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0` : "?vsn=1.0.0";
  return `${realtimeUrl}${suffix}`;
}

export function assertServerOnlySupabaseKey() {
  if (!getSupabaseConfig().serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  }
}
