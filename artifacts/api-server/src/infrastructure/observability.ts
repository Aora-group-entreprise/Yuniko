export type MetricSnapshot = {
  requests: number;
  errors5xx: number;
  feedRequests: number;
  liveSessionsStarted: number;
  liveSessionsEnded: number;
  liveConnections: number;
  totalRequestMs: number;
  uptimeSeconds: number;
};

const startedAt = Date.now();
const metrics: MetricSnapshot = {
  requests: 0,
  errors5xx: 0,
  feedRequests: 0,
  liveSessionsStarted: 0,
  liveSessionsEnded: 0,
  liveConnections: 0,
  totalRequestMs: 0,
  uptimeSeconds: 0,
};

export function observeRequest(durationMs: number, statusCode: number, path: string) {
  metrics.requests += 1;
  metrics.totalRequestMs += Math.max(0, durationMs);
  if (statusCode >= 500) metrics.errors5xx += 1;
  if (path.includes("/api/posts") || path.includes("/api/feed")) metrics.feedRequests += 1;
}

export function observeLiveStarted() { metrics.liveSessionsStarted += 1; }
export function observeLiveEnded() { metrics.liveSessionsEnded += 1; }
export function observeLiveConnection(delta: 1 | -1) {
  metrics.liveConnections = Math.max(0, metrics.liveConnections + delta);
}

export function getMetrics(): MetricSnapshot & { averageRequestMs: number } {
  const requests = metrics.requests;
  return {
    ...metrics,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    averageRequestMs: requests ? metrics.totalRequestMs / requests : 0,
  };
}

/** Lightweight alert thresholds; integrations can consume this without changing metric collection. */
export function getAlerts() {
  const snapshot = getMetrics();
  const errorRate = snapshot.requests ? snapshot.errors5xx / snapshot.requests : 0;
  return {
    high5xxRate: errorRate >= 0.05,
    highLatency: snapshot.averageRequestMs >= 1000,
    liveConnectionsHigh: snapshot.liveConnections >= 500,
  };
}
