import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { isSupabaseConfigured } from "../infrastructure/supabase";

const router: IRouter = Router();

const REQUIRED_TABLES = [
  "users",
  "posts",
  "post_engagements",
  "comments",
  "follows",
  "notifications",
  "stories",
  "story_views",
  "story_reactions",
  "story_replies",
  "conversations",
  "conversation_members",
  "messages",
  "message_requests",
  "calls",
  "call_signals",
  "live_sessions",
  "live_engagements",
  "live_comments",
  "user_settings",
];

router.get("/healthz", async (_req, res) => {
  try {
    // DATABASE_URL points to Yuniko's Supabase PostgreSQL instance.
    // Check both connectivity and the tables required by the live application.
    await db.execute(sql`select 1`);

    const rows = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = any(${sql.raw(`ARRAY[${REQUIRED_TABLES.map((name) => `'${name}'`).join(",")}]`)})
    `);
    const existingTables = new Set((rows as unknown as Array<{ table_name: string }>).map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((name) => !existingTables.has(name));

    const bucketRows = await db.execute(sql`
      select id
      from storage.buckets
      where id = 'media'
      limit 1
    `);
    const mediaBucketReady = (bucketRows as unknown as Array<{ id: string }>).some((row) => row.id === "media");

    if (missingTables.length > 0 || !mediaBucketReady) {
      res.status(503).json({
        status: "error",
        database: "connected",
        supabase: isSupabaseConfigured(),
        schema: missingTables.length === 0 ? "ready" : "incomplete",
        missingTables,
        mediaBucket: mediaBucketReady ? "ready" : "missing",
      });
      return;
    }

    const data = HealthCheckResponse.parse({ status: "ok" });
    res.json({
      ...data,
      database: "connected",
      supabase: isSupabaseConfigured(),
      schema: "ready",
      mediaBucket: "ready",
    });
  } catch {
    res.status(503).json({
      status: "error",
      database: "unavailable",
      supabase: isSupabaseConfigured(),
      schema: "unknown",
      mediaBucket: "unknown",
    });
  }
});

export default router;
