---
name: Yuniko frontend API proxy
description: Required local routing between the Vite frontend and the Yuniko API server.
---

The Yuniko frontend must proxy `/api` requests to the API server because the Vite frontend and API run on different ports. The target defaults to `http://127.0.0.1:8080` and can be overridden with `API_SERVER_URL`.

**Why:** Browser-relative `/api` requests otherwise hit Vite itself, returning the frontend HTML instead of the API response and surfacing as signup/signin network errors.

**How to apply:** Keep the `/api` proxy configured in both Vite development and preview servers whenever the frontend and API remain separate services.