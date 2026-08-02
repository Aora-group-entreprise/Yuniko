import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Lazy — DB connection is not established until first use.
// This prevents the server from crashing at startup when DATABASE_URL is not set.
function initDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

let _pool: InstanceType<typeof Pool> | undefined;
let _db: NodePgDatabase<typeof schema> | undefined;

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const result = initDb();
    _pool = result.pool;
    _db = result.db;
  }
  return _db;
}

function getPool(): InstanceType<typeof Pool> {
  if (!_pool) {
    const result = initDb();
    _pool = result.pool;
    _db = result.db;
  }
  return _pool;
}

// Proxy so existing `import { db } from "@workspace/db"` continue to work,
// but the connection is deferred until the first actual query.
export const db = new Proxy({} as object, {
  get(_, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as NodePgDatabase<typeof schema>;

export const pool = new Proxy({} as object, {
  get(_, prop) {
    return (getPool() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as InstanceType<typeof Pool>;

export * from "./schema";
