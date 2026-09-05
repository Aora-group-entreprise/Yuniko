import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Client, Pool } = pg;

type RequestDbContext = {
  client: InstanceType<typeof Client>;
  db: NodePgDatabase<typeof schema>;
  connected: boolean;
};

const requestDb = new AsyncLocalStorage<RequestDbContext>();

// Hyperdrive already owns the database-side connection pool. In Workers, use a
// short-lived pg Client for each request so the Worker isolate never owns a
// long-lived application pool. The fallback Pool remains available for local
// scripts and long-lived Node processes that use this package outside Workers.
function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return url;
}

function createRequestContext(): RequestDbContext {
  const client = new Client({ connectionString: getDatabaseUrl() });
  return {
    client,
    db: drizzle(client, { schema }),
    connected: false,
  };
}

export function runWithRequestDb<T>(callback: () => T): T {
  return requestDb.run(createRequestContext(), callback);
}

export async function closeRequestDb(): Promise<void> {
  const context = requestDb.getStore();
  if (!context) return;
  if (context.connected) {
    await context.client.end();
  }
}

async function ensureRequestClientConnected(): Promise<void> {
  const context = requestDb.getStore();
  if (!context || context.connected) return;
  await context.client.connect();
  context.connected = true;
}

function initFallbackDb() {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

let _fallbackPool: InstanceType<typeof Pool> | undefined;
let _fallbackDb: NodePgDatabase<typeof schema> | undefined;

function getFallbackDb(): NodePgDatabase<typeof schema> {
  if (!_fallbackDb) {
    const result = initFallbackDb();
    _fallbackPool = result.pool;
    _fallbackDb = result.db;
  }
  return _fallbackDb;
}

function getFallbackPool(): InstanceType<typeof Pool> {
  if (!_fallbackPool) {
    const result = initFallbackDb();
    _fallbackPool = result.pool;
    _fallbackDb = result.db;
  }
  return _fallbackPool;
}

// Proxy keeps the existing `import { db } from "@workspace/db"` API intact.
// Inside an HTTP request it uses that request's short-lived Client. Outside a
// request (CLI/scripts) it falls back to the traditional Node.js Pool.
export const db = new Proxy({} as object, {
  get(_, prop) {
    const context = requestDb.getStore();
    if (context) {
      // Drizzle/pg connects lazily when the first query executes. The explicit
      // connection is scheduled by the middleware before route handling.
      return (context.db as unknown as Record<string, unknown>)[prop as string];
    }
    return (getFallbackDb() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as NodePgDatabase<typeof schema>;

export const pool = new Proxy({} as object, {
  get(_, prop) {
    const context = requestDb.getStore();
    if (context) {
      return (context.client as unknown as Record<string, unknown>)[prop as string];
    }
    return (getFallbackPool() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as InstanceType<typeof Pool>;

export { ensureRequestClientConnected };
export * from "./schema";
