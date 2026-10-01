declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;

  export interface DurableObjectState {
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
    setWebSocketAutoResponse(pair: unknown): void;
  }

  export abstract class DurableObject {
    protected readonly ctx: DurableObjectState;
    constructor(ctx: DurableObjectState, env: unknown);
  }
}
