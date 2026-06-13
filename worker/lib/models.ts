import { Env } from "./env";

// Allowlist so the client can't inject arbitrary model strings.
// These are called via the Perplexity Agent API (provider/model ids).
export const ALLOWED_MODELS = ["openai/gpt-5.5", "openai/gpt-5.4-nano"];

/** Pick a valid model: requested (if allowed) -> env default (if allowed) -> first allowed. */
export function resolveModel(requested: unknown, env: Env): string {
  if (typeof requested === "string" && ALLOWED_MODELS.includes(requested)) return requested;
  if (env.PERPLEXITY_MODEL && ALLOWED_MODELS.includes(env.PERPLEXITY_MODEL)) {
    return env.PERPLEXITY_MODEL;
  }
  return ALLOWED_MODELS[0];
}
