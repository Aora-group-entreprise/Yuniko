type Row = Record<string, unknown>;
type Filter = { column: string; operator: "eq" | "gt" | "ilike"; value: string | number | boolean | Date };

const SUPABASE_URL = (process.env["SUPABASE_URL"] ?? "").replace(/\/+$/, "");
const SUPABASE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
  process.env["SUPABASE_ANON_KEY"] ??
  process.env["SUPABASE_KEY"] ??
  "";

function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function serializeValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}

function fromSupabaseRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const camelKey = toCamelCase(key);
      if ((camelKey === "createdAt" || camelKey === "expiresAt") && typeof value === "string") {
        return [camelKey, new Date(value)];
      }
      return [camelKey, value];
    }),
  );
}

function toSupabaseRow(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [toSnakeCase(key), serializeValue(value)]),
  );
}

function getRestUrl(path: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
  }
  return `${SUPABASE_URL}/rest/v1${path.startsWith("/") ? path : `/${path}`}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getRestUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload === "string"
        ? payload
        : (payload as { message?: string; error?: string } | null)?.message ??
          (payload as { error?: string } | null)?.error ??
          response.statusText;
    throw new Error(`Supabase ${response.status}: ${detail}`);
  }

  return payload as T;
}

export async function selectRows<T extends Row = Row>(
  table: string,
  options: {
    select?: string;
    filters?: Filter[];
    order?: { column: string; ascending?: boolean };
    limit?: number;
  } = {},
): Promise<T[]> {
  const params = new URLSearchParams();
  params.set("select", options.select ?? "*");
  for (const filter of options.filters ?? []) {
    const value = serializeValue(filter.value);
    params.set(filter.column === "id" ? filter.column : toSnakeCase(filter.column), `${filter.operator}.${value}`);
  }
  if (options.order) {
    params.set(
      "order",
      `${toSnakeCase(options.order.column)}.${options.order.ascending === false ? "desc" : "asc"}`,
    );
  }
  if (options.limit !== undefined) params.set("limit", String(options.limit));

  const rows = await request<Row[]>(`/${table}?${params.toString()}`);
  return rows.map(fromSupabaseRow) as T[];
}

export async function insertRow<T extends Row = Row>(table: string, values: Row): Promise<T> {
  const rows = await request<Row[]>(`/${table}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toSupabaseRow(values)),
  });
  const row = rows[0];
  if (!row) throw new Error(`Supabase insert into ${table} returned no row`);
  return fromSupabaseRow(row) as T;
}

export async function updateRows<T extends Row = Row>(
  table: string,
  values: Row,
  filters: Filter[],
): Promise<T[]> {
  const params = new URLSearchParams();
  for (const filter of filters) {
    params.set(toSnakeCase(filter.column), `${filter.operator}.${serializeValue(filter.value)}`);
  }
  const rows = await request<Row[]>(`/${table}?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toSupabaseRow(values)),
  });
  return rows.map(fromSupabaseRow) as T[];
}

export async function deleteRows(table: string, filters: Filter[]) {
  const params = new URLSearchParams();
  for (const filter of filters) {
    params.set(toSnakeCase(filter.column), `${filter.operator}.${serializeValue(filter.value)}`);
  }
  await request(`/${table}?${params.toString()}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export function eq(column: string, value: string | number | boolean | Date): Filter {
  return { column, operator: "eq", value };
}

export function gt(column: string, value: string | number | boolean | Date): Filter {
  return { column, operator: "gt", value };
}

export function ilike(column: string, value: string): Filter {
  return { column, operator: "ilike", value };
}

export function countRows(rows: Row[]) {
  return rows.length;
}

export function publicUser<T extends Row>(user: T) {
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

export function supabaseError(res: { status: (code: number) => { json: (body: unknown) => unknown } }, err: unknown) {
  console.error(err);
  return res.status(503).json({
    error: "Supabase backend is unavailable. Check the Supabase connection for this environment.",
  });
}

export function filterRows<T extends Row>(rows: T[], ...filters: Filter[]) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[toCamelCase(filter.column)] ?? row[filter.column];
      if (filter.operator === "eq") return value === filter.value;
      if (filter.operator === "gt") return new Date(String(value)).getTime() > new Date(String(filter.value)).getTime();
      return String(value ?? "").toLowerCase().includes(String(filter.value).replaceAll("%", "").toLowerCase());
    }),
  );
}

export function sortRows<T extends Row>(rows: T[], column: string, ascending = true) {
  return [...rows].sort((a, b) => {
    const left = a[column] instanceof Date ? (a[column] as Date).getTime() : String(a[column] ?? "");
    const right = b[column] instanceof Date ? (b[column] as Date).getTime() : String(b[column] ?? "");
    if (left < right) return ascending ? -1 : 1;
    if (left > right) return ascending ? 1 : -1;
    return 0;
  });
}
