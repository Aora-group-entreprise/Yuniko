import { handleAsNodeRequest } from "cloudflare:node";
import { env } from "cloudflare:workers";
import app from "./app";

// Express runs inside Workers through Cloudflare's Node HTTP compatibility
// layer. Hyperdrive's connection string is request-scoped: Cloudflare does
// not allow I/O against Hyperdrive from global scope. The existing Drizzle
// layer can keep reading DATABASE_URL without changing JWT authentication.
app.listen(3000);

export default {
  async fetch(request: Request): Promise<Response> {
    const hyperdrive = env.HYPERDRIVE as { connectionString?: string } | undefined;
    if (!hyperdrive?.connectionString) {
      return Response.json({ error: "Database binding is not configured" }, { status: 503 });
    }

    process.env.DATABASE_URL = hyperdrive.connectionString;
    return handleAsNodeRequest(3000, request);
  },
};
