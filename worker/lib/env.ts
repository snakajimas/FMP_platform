import type { LlmConfig } from "./llm";

export interface Env {
  // Static assets binding (the built SPA in ./dist).
  ASSETS: Fetcher;
  // FMP data API.
  FMP_API_KEY: string;
  // Perplexity Agent API key (routes to openai/* etc. via provider/model ids).
  PERPLEXITY_API_KEY?: string;
  // Optional override of the Agent API base URL (default below).
  AI_BASE_URL?: string;
  // Default model when the client doesn't specify one (or sends an unknown id).
  PERPLEXITY_MODEL?: string;
}

const DEFAULT_BASE_URL = "https://api.perplexity.ai/v1";

/** Resolve the Perplexity Agent API endpoint + key from env. */
export function getLlmConfig(env: Env): LlmConfig {
  return {
    baseUrl: env.AI_BASE_URL || DEFAULT_BASE_URL,
    apiKey: env.PERPLEXITY_API_KEY || "",
  };
}

/** Whether the Perplexity key is configured. */
export function hasAiKey(env: Env): boolean {
  return Boolean(env.PERPLEXITY_API_KEY);
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
