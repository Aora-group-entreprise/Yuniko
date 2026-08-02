---
name: Auth system
description: JWT authentication architecture, key decisions, and gotchas for Yuniko.
---

# Auth System

## Architecture
- **Backend**: Express routes at `/api/auth/*`, JWT signed with `SESSION_SECRET` env var (30-day expiry via `jsonwebtoken`), passwords hashed with `bcryptjs` (12 rounds).
- **DB**: `usersTable` in `lib/db/src/schema/users.ts` — username (unique, lowercased), displayName, passwordHash, country, countryFlag, age, avatarUrl (base64 TEXT), bio.
- **Frontend**: `AuthProvider` in `artifacts/yuniko/src/lib/auth-context.tsx` stores token + user in `localStorage` keys `yuniko_token` / `yuniko_user`. `useAuth()` hook provides login/logout/updateUser.
- **Routing**: `AppContent` in `App.tsx` — after splash + auth load, redirects unauthenticated users to `/login`, and redirects already-logged-in users away from `/login`.

## API endpoints
- `GET  /api/auth/check-username/:username` — availability check (debounced from frontend)
- `POST /api/auth/register` — creates user, returns `{ token, user }`
- `POST /api/auth/login` — returns `{ token, user }`
- `GET  /api/auth/me` — requires `Authorization: Bearer <token>`
- `POST /api/auth/reset-password` — `{ username, newPassword }`, no email needed

## Key decisions

**Lazy DB proxy (lib/db/src/index.ts)**
The `db` export is a JS Proxy that only creates the PG connection when a property is first accessed. This prevents the API server from crashing at startup when `DATABASE_URL` is not set.
**Why:** The server must stay up so Replit's health checks pass even before the database is provisioned.
**How to apply:** Keep `lib/db/src/index.ts` using the lazy proxy pattern; do not revert to a top-level `new Pool(...)` call.

**Avatar storage as base64 in TEXT column**
Profile photos are resized to 300×300 JPEG on the client (Canvas API) before upload; stored as a base64 data URL in `avatarUrl TEXT`.
**Why:** No object storage is provisioned yet; TEXT can hold ~40KB base64 without issue.
**How to apply:** Migrate to object storage (App Storage) when avatars cause DB bloat. The `avatarUrl` column already holds any URL string, so migration is just changing what's stored.

**No email verification**
Forgot-password resets by username only (no email). Anyone who knows the username can reset the password.
**Why:** Explicitly requested — no email verification in the system.

**Schema must be pushed manually**
After any change to `lib/db/src/schema/`, run:
```
pnpm --filter @workspace/db run push
```
The first time this was needed: `users` table didn't exist → `relation "users" does not exist` error at runtime.
