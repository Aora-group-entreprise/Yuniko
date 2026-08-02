# Yuniko

A social media app with posts, stories, messaging, live video, and real-time calls.

## Run & Operate

- Workflows manage all services — start them from the Replit UI or with the run button.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/yuniko run dev` — run the frontend (port 21753)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS v4 + shadcn/ui + Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild

## Where things live

- `artifacts/yuniko/` — React frontend
- `artifacts/api-server/` — Express API server
- `lib/db/` — Drizzle schema + DB client (source of truth for DB schema)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — generated React Query hooks (run codegen to update)
- `lib/api-zod/` — generated Zod schemas

## Architecture decisions

- API shape is defined in the OpenAPI spec; client hooks and Zod validators are generated from it via Orval — never edit generated files directly.
- DB schema lives in `lib/db/src/schema/`; run `pnpm --filter @workspace/db run push` to sync to the dev database.
- Frontend uses path-based routing via Wouter; all routes are registered in `artifacts/yuniko/src/App.tsx`.

## Product

Social media platform: home feed, posts, stories, messaging (1:1 and group), live video, voice/video calls, notifications, search, user profiles, and settings.

## Gotchas

- The API server and DB client both require `DATABASE_URL` to be set — provision a Replit PostgreSQL database and add the secret before using any API features.
- Generated files in `lib/api-client-react/` and `lib/api-zod/` must be regenerated after any OpenAPI spec change.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
