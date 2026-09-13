// Some older pages call fetch("/api/...") directly instead of using apiFetch().
// In production the frontend is on Cloudflare Pages and the API is a separate
// Worker. Use the deployed API as a safe fallback when VITE_API_URL is absent.
//
// NOTE: Prefer using the same-origin Pages Functions proxy by default to avoid
// CORS problems. Setting the default API base to an empty string leaves
// `fetch("/api/...")` as a relative request which will hit the Pages
// Function at /api/... when the app is deployed to Cloudflare Pages.
const DEFAULT_API_BASE_URL = ""; // previously pointed to the external worker
const apiBase = String(import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, "");

if (apiBase && typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string;

    if (typeof input === "string") {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
    }

    if (url.startsWith("/api/")) {
      // If apiBase is non-empty we rewrite /api/ to the configured remote API.
      // When apiBase === "" we keep the relative URL so the same-origin Pages
      // Function handles the request (avoids CORS).
      url = apiBase ? `${apiBase}${url}` : url;
      if (input instanceof Request) {
        return originalFetch(new Request(url, input), init);
      }
      return originalFetch(url, init);
    }

    return originalFetch(input, init);
  };
}
