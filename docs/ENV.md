# Yuniko — Environment & troubleshooting

This document explains the runtime environment variables and quick troubleshooting steps for common errors such as "Failed to fetch" or "Network error" in the Yuniko frontend.

## Key environment variables

- VITE_API_URL
  - The frontend rewrites requests that start with `/api/` to the configured API base URL.
  - If `VITE_API_URL` is omitted in the build, the frontend falls back to a default deployed API URL.
  - To make the frontend use the same origin (so `/api/...` hits your Pages Functions or local dev server and avoids CORS), set `VITE_API_URL` to an empty string when building the frontend. Example (vite / npm env):
    - VITE_API_URL=""

- CORS_ORIGINS (API)
  - The Express API reads `CORS_ORIGINS` (comma separated) to decide which frontend origins to allow.
  - Example for local dev + staging frontend:

    CORS_ORIGINS="http://localhost:5173,https://your-frontend.example.com"

  - If the browser console shows a CORS error (blocked by CORS policy), ensure the frontend origin is present in this list.

- Supabase storage configuration (API)
  - The server expects the following environment variables to be defined for media uploads:
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - SUPABASE_MEDIA_BUCKET
  - If these are missing or invalid, creating posts/stories that upload image data URLs will fail with a `503 Supabase Storage is not configured` response.

## Debugging network / "Failed to fetch" errors

1. Reproduce the error in the browser and open DevTools -> Network.
   - Locate the failing `/api/...` request.
   - Check the request URL, response status, response body, and console messages.
   - Common findings:
     - CORS blocked: browser console shows "Access to fetch at '...' from origin '...' has been blocked by CORS policy" → add the frontend origin to `CORS_ORIGINS`.
     - 503 with message "Supabase Storage is not configured" → set the Supabase env vars on the API.
     - No response / TypeError "Failed to fetch" → could be DNS/network or the frontend is trying to reach the wrong API URL.

2. Test the API directly (bypassing the browser/CORS):

```bash
curl -v https://yuniko-api.lafatriniainaallane.workers.dev/api/health
# Example search test (requires token if your API enforces auth):
curl -v 'https://yuniko-api.lafatriniainaallane.workers.dev/api/users/search?q=alice' -H "Authorization: Bearer <token>"
```

3. Ensure the frontend build is configured as intended:
   - To let Pages Functions handle `/api` without cross-origin rewrites, build with `VITE_API_URL=""`.
   - If you want the frontend to call an external API, set `VITE_API_URL` to the API base URL (no trailing slash).

## UX improvements in the client

- The frontend now surfaces clearer network errors such as timeouts or aborted requests (you will see messages like "Request timed out or was aborted while calling /posts").
- Server-side error payloads are propagated to the UI when possible (the client already throws the server `error` field when responses are non-OK).

## Next steps when debugging

- If you can paste a failing Network request (method, URL, status, response body) or a browser console message, I can give a precise fix and prepare a follow-up PR if needed.

---

If you want, I can also:
- open a PR that additionally adds a small UI-friendly notification wrapper to display network/server errors in the app UI (so users see messages instead of generic toasts), or
- add server-side checks that log helpful diagnostic lines when Supabase or the database bindings are missing.
