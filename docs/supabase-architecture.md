# Yuniko infrastructure

Yuniko keeps one primary infrastructure provider for persistent data and media: Supabase.

- **PostgreSQL:** the source of truth for accounts, posts, messages, social relationships and settings. Drizzle remains the ORM and connects through `DATABASE_URL`.
- **Storage:** photos, avatars and future videos live in Supabase Storage. PostgreSQL stores metadata and object URLs/paths, not binary media payloads.
- **Realtime:** Supabase Realtime is the optional realtime transport for events/signaling where it fits the existing WebRTC architecture.
- **Auth:** the current application auth remains the source of truth until a deliberate Supabase Auth migration is made; no silent credential migration is performed by this infrastructure layer.
- **CDN:** `MEDIA_PUBLIC_BASE_URL` can point at a CDN later. When empty, media URLs use Supabase Storage's public URL format.
- **Video:** `VIDEO_ENABLED=false` by default. The upload path remains present and must return the existing Coming Soon behavior while disabled.
- **Live:** `LIVE_ENABLED=false`, `SFU_ENABLED=false`, and `LIVE_RECORDING_ENABLED=false` by default.

The server-only `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
