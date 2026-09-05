import { httpServerHandler } from "cloudflare:node";
import app from "./app";

// Express creates the Node HTTP server. Cloudflare's current runtime supports
// passing that server directly to httpServerHandler; the local type definition
// in this workspace only exposes the port-based overload, so keep the cast
// narrowly scoped to this bridge.
const server = app.listen(3000);

export default httpServerHandler(server as unknown as { port: number });
