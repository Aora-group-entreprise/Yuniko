export type SharedState = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  publish(channel: string, payload: unknown): Promise<void>;
};

/**
 * Multi-server contract. The local implementation keeps development and
 * single-server deployments working; Redis/another broker can implement the
 * same interface when MULTI_SERVER_ENABLED is turned on.
 */
export class LocalSharedState implements SharedState {
  private readonly values = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const item = this.values.get(key);
    if (!item || item.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number) {
    this.values.set(key, {
      value,
      expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
    });
  }

  async del(key: string) {
    this.values.delete(key);
  }

  async publish(_channel: string, _payload: unknown) {
    // Intentionally a no-op until a shared broker is configured.
  }
}

export const sharedState = new LocalSharedState();

export function assertMultiServerReady() {
  if (process.env.MULTI_SERVER_ENABLED !== "true") return;
  if (process.env.REDIS_ENABLED !== "true" || !process.env.REDIS_URL?.trim()) {
    throw new Error("MULTI_SERVER_ENABLED requires a configured shared broker");
  }
}
