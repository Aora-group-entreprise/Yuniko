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

export type MediaObject = {
  key: string;
  contentType: string;
  url: string;
};

/**
 * Storage abstraction. Keeping this behind an interface lets production use
 * S3/R2/GCS + CDN without changing post/media APIs or storing base64 blobs in DB.
 */
export interface ObjectStorage {
  put(input: { key: string; body: Buffer; contentType: string }): Promise<MediaObject>;
  delete(key: string): Promise<void>;
}

export class ConfiguredObjectStorage implements ObjectStorage {
  async put(input: { key: string; body: Buffer; contentType: string }): Promise<MediaObject> {
    const baseUrl = process.env.MEDIA_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error("MEDIA_PUBLIC_BASE_URL is not configured");
    }
    throw new Error("Object storage adapter is not configured for this deployment");
  }

  async delete(_key: string): Promise<void> {
    if (!process.env.MEDIA_PUBLIC_BASE_URL) return;
    throw new Error("Object storage adapter is not configured for this deployment");
  }
}

export type LiveTransport = "webrtc" | "sfu";

/** SFU-ready transport selection without enabling recording or replay. */
export function getLiveTransport(): LiveTransport {
  return process.env.LIVE_SFU_URL ? "sfu" : "webrtc";
}
