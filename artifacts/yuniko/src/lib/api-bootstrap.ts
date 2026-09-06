// Some older pages call fetch("/api/...") directly instead of using apiFetch().
// In production the frontend is on Cloudflare Pages and the API is a separate
// Worker. Use the deployed API as a safe fallback when VITE_API_URL is absent.
const DEFAULT_API_BASE_URL = "https://yuniko-api.lafatriniainaallane.workers.dev";
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
      url = `${apiBase}${url}`;
      if (input instanceof Request) {
        return originalFetch(new Request(url, input), init);
      }
      return originalFetch(url, init);
    }

    return originalFetch(input, init);
  };
}
