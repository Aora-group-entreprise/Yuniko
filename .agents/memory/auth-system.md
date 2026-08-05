---
name: Auth system
description: JWT authentication architecture, key decisions, and gotchas for Yuniko.
---

# Auth System

## Architecture
- **Backend**: Express routes at `/api/auth/*`, JWT signed with `SESSION_SECRET` env var (30-day expiry via `jsonwebtoken`), passwords hashed with `bcryptjs` (12 rounds).
- **DB**: `usersTable` in `lib/db/src/schema/users.ts` — username (unique, lowercased), displayName, passwordHash, country, countryFlag, age, avatarUrl (base64 TEXT), bio, website, createdAt.
- **Frontend**: `AuthProvider` in `artifacts/yuniko/src/lib/auth-context.tsx` stores token + user in `localStorage` keys `yuniko_token` / `yuniko_user`. `useAuth()` hook provides login/logout/updateUser/refreshUser.
- **Routing**: `AppContent` in `App.tsx` — after splash + auth load, redirects unauthenticated users to `/login`, and redirects already-logged-in users away from `/login`.

## API endpoints
- `GET  /api/auth/check-username/:username` — availability check (debounced from frontend)
- `POST /api/auth/register` — creates user, returns `{ token, user }`
- `POST /api/auth/login` — returns `{ token, user }`
- `GET  /api/auth/me` — requires `Authorization: Bearer <token>`
- `PATCH /api/auth/me` — update profile fields (displayName, bio, website, country, countryFlag, avatarUrl); requires auth
- `POST /api/auth/reset-password` — `{ username, newPassword }`, no email needed

## AuthUser interface fields (auth-context.tsx)
`id`, `username`, `displayName`, `avatarUrl`, `country`, `countryFlag`, `age`, `bio`, `website`, `createdAt`

## Pages wired to real auth user (no more mockData for identity)
- `profile.tsx` — own profile uses `authUserToDisplay(authUser)` adapter; other users still use mockData
- `edit-profile.tsx` — reads from `useAuth().user`, saves via `PATCH /api/auth/me`, calls `updateUser()`
- `settings.tsx` — profile summary uses `authUser` directly
- `create.tsx` — avatar/username row uses `useAuth().user`
- `live.tsx` — header avatar/name uses `useAuth().user`
- `StoryAvatar.tsx` — own story avatar uses `authUser.avatarUrl`

## API helper
`artifacts/yuniko/src/lib/api.ts` — `apiFetch()` and `apiJson<T>()` helpers that auto-attach Bearer token from localStorage. Use relative `/api/...` paths (Replit path routing handles the port forwarding).

## Key decisions

**Lazy DB proxy (lib/db/src/index.ts)**
The `db` export is a JS Proxy that only creates the PG connection when a property is first accessed. This prevents the API server from crashing at startup when `DATABASE_URL` is not set.
**Why:** The server must stay up so Replit's health checks pass even before the database is provisioned.
**How to apply:** Keep `lib/db/src/index.ts` using the lazy proxy pattern; do not revert to a top-level `new Pool(...)` call.

**Avatar storage as base64 in TEXT column**
Profile photos are resized to 300×300 JPEG on the client (Canvas API) before upload; stored as a base64 data URL in `avatarUrl TEXT`.
**Why:** No object storage is provisioned yet; TEXT can hold ~40KB base64 without issue.
**How to apply:** Migrate to object storage (App Storage) when avatars cause DB bloat. The `avatarUrl` column already holds any URL string, so migration is just changing what's stored.

**Avatar fallback**
When `avatarUrl` is null, the app renders `https://api.dicebear.com/8.x/initials/svg?seed=<displayName>&backgroundColor=FF006E` deterministically. Never use picsum.photos `seed/me` for the authenticated user — that was the mock placeholder.

**authUserToDisplay() adapter in profile.tsx**
`AuthUser` fields don't map 1:1 to the mock `User` shape (missing: verified, followers, following, posts, isOnline, coverPhoto). The adapter converts them with safe defaults (0 counts, false flags). Fields will be real once a proper posts/follows DB schema is added.
**Why:** Avoids changing the DB schema prematurely; profile page stays functional.

**No email verification**
Forgot-password resets by username only (no email). Anyone who knows the username can reset the password.
**Why:** Explicitly requested — no email verification in the system.

**Schema must be pushed manually**
After any change to `lib/db/src/schema/`, run:
```
pnpm --filter @workspace/db run push
```
The `website` column was added alongside the initial users table.

**mockData still used for feed content**
Stories, posts, conversations, notifications in the feed are still mock data. Only the *identity* of the authenticated user (avatar, name, bio, etc.) is now real. Real feed data requires a posts/follows/messages DB schema (separate task).
