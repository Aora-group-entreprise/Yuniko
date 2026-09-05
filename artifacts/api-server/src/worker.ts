import { httpServerHandler } from "cloudflare:node";
import app from "./app";

// Cloudflare officially supports Express/Node HTTP servers through
// httpServerHandler. The Hyperdrive binding is consumed inside the Express
// request middleware, so database I/O stays request-scoped.
const server = app.listen(3000);

export default httpServerHandler(server);
