import type { LlmConfig } from "./llm";

export interface Env {
  // Static assets binding (the built SPA in ./dist).
  ASSETS: Fetcher;
  // FMP data API.
  FMP_API_KEY: string;
  // AI provider (OpenAI-compatible /chat/completions).
  //   AI_BASE_URL: default https://api.perplexity.ai (Perplexity / Sonar).
  //                set to https://openrouter.ai/api/v1 (or OpenAI) to use GPT models.
  //   AI_API_KEY : key for AI_BASE_URL. Falls back to PERPLEXITY_API_KEY.
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  // Default model when the client doesn't specify one (or sends an unknown id).
  PERPLEXITY_MODEL?: string;
}

const DEFAULT_BASE_URL = "https://api.perplexity.ai";

/** Resolve the AI provider endpoint + key from env. */
export function getLlmConfig(env: Env): LlmConfig {
  return {
    baseUrl: env.AI_BASE_URL || DEFAULT_BASE_URL,
    apiKey: env.AI_API_KEY || env.PERPLEXITY_API_KEY || "",
  };
}

/** Whether an AI key is configured (either var). */
export function hasAiKey(env: Env): boolean {
  return Boolean(env.AI_API_KEY || env.PERPLEXITY_API_KEY);
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
