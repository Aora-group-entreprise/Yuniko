---
name: Supabase backend through Replit connector
description: Environment-specific behavior for Yuniko's Supabase data access.
---

Yuniko uses the Replit connectors SDK with the `supabase` connector for application data. The connector exposes PostgREST table paths such as `/users` and `/posts`; `/rest/v1/...` is not the working path in this environment.

**Why:** The attached Supabase integration is authenticated by the Replit runtime, so the API must not depend on a project API key or Supabase Auth.

**How to apply:** Keep Yuniko's bcrypt/JWT authentication independent from Supabase Auth, and route database operations through the connector proxy.