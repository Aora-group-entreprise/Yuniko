const API_ORIGIN = "https://yuniko-api.lafatriniainaallane.workers.dev";

export const onRequest = async (context: { request: Request; params: { path?: string | string[] } }) => {
  const path = Array.isArray(context.params.path)
    ? context.params.path.join("/")
    : context.params.path ?? "";
  const incoming = new URL(context.request.url);
  const target = `${API_ORIGIN}/api/${path}${incoming.search}`;
  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const response = await fetch(target, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "manual",
  });

  return response;
};
