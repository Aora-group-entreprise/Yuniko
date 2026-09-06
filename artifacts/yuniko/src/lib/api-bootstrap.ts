// Some older pages call fetch("/api/...") directly instead of using apiFetch().
// In production the frontend is on Cloudflare Pages and the API is a separate
// Worker, so transparently prefix those same-origin API URLs with VITE_API_URL.
const apiBase = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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
