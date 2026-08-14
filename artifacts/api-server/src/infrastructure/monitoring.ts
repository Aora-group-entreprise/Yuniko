export type MetricName =
  | "feed_requests"
  | "feed_cache_hits"
  | "feed_cache_misses"
  | "live_starts"
  | "live_viewers"
  | "live_ends";

type Metric = { count: number; total: number; max: number };

const metrics = new Map<MetricName, Metric>();

function metric(name: MetricName) {
  const current = metrics.get(name) ?? { count: 0, total: 0, max: 0 };
  metrics.set(name, current);
  return current;
}

export function recordMetric(name: MetricName, value = 1) {
  const current = metric(name);
  current.count += 1;
  current.total += value;
  current.max = Math.max(current.max, value);
}

export function getMetricsSnapshot() {
  return Object.fromEntries(
    [...metrics.entries()].map(([name, value]) => [name, { ...value }]),
  ) as Record<MetricName, Metric>;
}

export function resetMetrics() {
  metrics.clear();
}

/**
 * Optional hook for an external monitoring system. It intentionally does
 * nothing unless explicitly enabled and configured.
 */
export async function emitExternalAlert(message: string) {
  if (process.env.EXTERNAL_ALERTS_ENABLED !== "true") return false;
  const webhook = process.env.EXTERNAL_ALERT_WEBHOOK?.trim();
  if (!webhook) return false;

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
  return response.ok;
}
