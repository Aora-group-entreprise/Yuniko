export type CacheProvider = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
};

/**
 * Process-local fallback. It is deliberately small and TTL-bound.
 * Production deployments can replace it with Redis without changing callers.
 */
export class MemoryCache implements CacheProvider {
  private readonly values = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.values.set(key, { value, expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000 });
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export const cache = new MemoryCache();

export type ScalingConfig = {
  sfuEnabled: boolean;
  objectStorageEnabled: boolean;
  cdnEnabled: boolean;
  redisEnabled: boolean;
  feedCacheEnabled: boolean;
  monitoringEnabled: boolean;
  externalAlertsEnabled: boolean;
  multiServerEnabled: boolean;
  redisUrl: string;
  cdnBaseUrl: string;
};

const enabled = (value: string | undefined) => value?.trim().toLowerCase() === "true";

/** P2 switches are opt-in and cannot silently activate new infrastructure. */
export function getScalingConfig(): ScalingConfig {
  return {
    sfuEnabled: enabled(process.env.SFU_ENABLED),
    objectStorageEnabled: Boolean(process.env.SUPABASE_URL?.trim()),
    cdnEnabled: enabled(process.env.MEDIA_CDN_ENABLED),
    redisEnabled: enabled(process.env.REDIS_ENABLED),
    feedCacheEnabled: enabled(process.env.FEED_CACHE_ENABLED),
    monitoringEnabled: enabled(process.env.MONITORING_ENABLED),
    externalAlertsEnabled: enabled(process.env.EXTERNAL_ALERTS_ENABLED),
    multiServerEnabled: enabled(process.env.MULTI_SERVER_ENABLED),
    redisUrl: process.env.REDIS_URL?.trim() ?? "",
    cdnBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL?.trim() ?? "",
  };
}

export function assertRedisReady() {
  const config = getScalingConfig();
  if (config.redisEnabled && !config.redisUrl) {
    throw new Error("REDIS_ENABLED=true requires REDIS_URL");
  }
}

export function getMediaDeliveryUrl(path: string) {
  const config = getScalingConfig();
  const cleanPath = path.replace(/^\/+/, "");
  if (config.cdnEnabled && config.cdnBaseUrl) {
    return `${config.cdnBaseUrl.replace(/\/$/, "")}/${cleanPath}`;
  }
  return cleanPath;
}

export type MediaObject = {
  key: string;
  contentType: string;
  url: string;
};

/**
 * Storage abstraction. A real Supabase Storage adapter can implement this
 * contract without changing post/media APIs or storing base64 blobs in DB.
 */
export interface ObjectStorage {
  put(input: { key: string; body: Buffer; contentType: string }): Promise<MediaObject>;
  delete(key: string): Promise<void>;
}

export type LiveTransport = "webrtc" | "sfu";

/** SFU-ready transport selection without enabling recording or replay. */
export function getLiveTransport(): LiveTransport {
  return process.env.SFU_ENABLED === "true" && process.env.LIVE_SFU_URL ? "sfu" : "webrtc";
}
