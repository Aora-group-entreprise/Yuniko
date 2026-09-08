declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

declare module "cloudflare:node" {
  export function handleAsNodeRequest(port: number, request: Request): Response | Promise<Response>;
}
