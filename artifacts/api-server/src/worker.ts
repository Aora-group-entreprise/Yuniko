import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";

// Cloudflare bindings are exposed through `env`, while the existing Yuniko
// backend reads its configuration from process.env. Populate only the values
// that the server already understands; JWT auth and Drizzle remain unchanged.
const bindings = env as Record<string, unknown>;
const copyEnv = (name: string) => {
  const value = bindings[name];
  if (typeof value === "string" && value.trim()) process.env[name] = value;
};

process.env.NODE_ENV = "production";
copyEnv("DATABASE_URL");
copyEnv("CORS_ORIGINS");
copyEnv("SESSION_SECRET");
copyEnv("METRICS_TOKEN");
copyEnv("SUPABASE_URL");
copyEnv("SUPABASE_SERVICE_ROLE_KEY");
copyEnv("SUPABASE_ANON_KEY");
copyEnv("SUPABASE_REALTIME_URL");
copyEnv("SUPABASE_STORAGE_BUCKET");
copyEnv("MEDIA_PUBLIC_BASE_URL");
copyEnv("VIDEO_ENABLED");
copyEnv("LIVE_ENABLED");
copyEnv("SFU_ENABLED");
copyEnv("LIVE_RECORDING_ENABLED");
copyEnv("LIVE_SFU_URL");
copyEnv("MULTI_SERVER_ENABLED");
copyEnv("REDIS_ENABLED");
copyEnv("REDIS_URL");
copyEnv("EXTERNAL_ALERTS_ENABLED");
copyEnv("EXTERNAL_ALERT_WEBHOOK");

// The Pages frontend calls the API from a different origin in production.
// Keep the current Yuniko Pages origin allowed unless an explicit CORS list is set.
if (!process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS = "https://yuniko-19d.pages.dev";
}

const { default: app } = await import("./app");

// Express runs inside Workers through Cloudflare's Node HTTP compatibility
// handler. Keep the existing Express app/routes intact instead of rewriting
// every route to the Workers Fetch API.
app.listen(3000);

export default httpServerHandler({ port: 3000 });
