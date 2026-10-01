declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;

  export interface DurableObjectState {
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
    setWebSocketAutoResponse(pair: unknown): void;
    storage: {
      get<T>(key: string): Promise<T | undefined>;
      put<T>(key: string, value: T): Promise<void>;
      delete(key: string): Promise<boolean>;
      setAlarm(scheduledTime: number): Promise<void>;
      deleteAlarm(): Promise<void>;
    };
  }

  export abstract class DurableObject {
    protected readonly ctx: DurableObjectState;
    constructor(ctx: DurableObjectState, env: unknown);
  }
}
