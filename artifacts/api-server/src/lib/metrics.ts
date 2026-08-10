type RouteMetric = { requests: number; errors: number; totalMs: number; lastMs: number };

const startedAt = Date.now();
const metrics = new Map<string, RouteMetric>();

export function recordRequest(method: string, path: string, statusCode: number, durationMs: number) {
  const key = `${method} ${path}`;
  const current = metrics.get(key) ?? { requests: 0, errors: 0, totalMs: 0, lastMs: 0 };
  current.requests += 1;
  if (statusCode >= 500) current.errors += 1;
  current.totalMs += durationMs;
  current.lastMs = durationMs;
  metrics.set(key, current);
}

export function snapshotMetrics() {
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    memory: process.memoryUsage(),
    routes: Object.fromEntries(
      [...metrics.entries()].map(([route, value]) => [route, {
        ...value,
        averageMs: value.requests ? Math.round(value.totalMs / value.requests) : 0,
      }]),
    ),
  };
}
