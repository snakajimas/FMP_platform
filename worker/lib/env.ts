export interface Env {
  // Static assets binding (the built SPA in ./dist).
  ASSETS: Fetcher;
  // Secrets / vars.
  FMP_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  PERPLEXITY_MODEL?: string;
}

export function json(data: unknown, init: number | ResponseInit = 200): Response {
  const responseInit: ResponseInit =
    typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(responseInit.headers || {}),
    },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}
