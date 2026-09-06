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

function getDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  return url;
}

function createRequestContext(databaseUrl?: string): RequestDbContext {
  const client = new Client({ connectionString: databaseUrl ?? getDatabaseUrl() });
  return { client, db: drizzle(client, { schema }), connected: false };
}

export function runWithRequestDb<T>(callback: () => T, databaseUrl?: string): T {
  return requestDb.run(createRequestContext(databaseUrl), callback);
}

export async function closeRequestDb(): Promise<void> {
  const context = requestDb.getStore();
  if (!context || !context.connected) return;
  context.connected = false;
  await context.client.end();
}

async function ensureRequestClientConnected(): Promise<void> {
  const context = requestDb.getStore();
  if (!context || context.connected) return;
  await context.client.connect();
  context.connected = true;
}

function initFallbackDb() {
  const pool = new Pool({ connectionString: getDatabaseUrl(), max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000, allowExitOnIdle: true });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

let _fallbackPool: InstanceType<typeof Pool> | undefined;
let _fallbackDb: NodePgDatabase<typeof schema> | undefined;

function getFallbackDb(): NodePgDatabase<typeof schema> {
  if (!_fallbackDb) { const result = initFallbackDb(); _fallbackPool = result.pool; _fallbackDb = result.db; }
  return _fallbackDb;
}

function getFallbackPool(): InstanceType<typeof Pool> {
  if (!_fallbackPool) { const result = initFallbackDb(); _fallbackPool = result.pool; _fallbackDb = result.db; }
  return _fallbackPool;
}

export const db = new Proxy({} as object, {
  get(_, prop) {
    const context = requestDb.getStore();
    if (context) return (context.db as unknown as Record<string, unknown>)[prop as string];
    return (getFallbackDb() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as NodePgDatabase<typeof schema>;

export const pool = new Proxy({} as object, {
  get(_, prop) {
    const context = requestDb.getStore();
    if (context) return (context.client as unknown as Record<string, unknown>)[prop as string];
    return (getFallbackPool() as unknown as Record<string, unknown>)[prop as string];
  },
}) as unknown as InstanceType<typeof Pool>;

export { ensureRequestClientConnected };
export * from "./schema";
