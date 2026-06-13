import { Env } from "./env";

// Allowlist so the client can't inject arbitrary model strings.
// Perplexity (sonar*) work with a Perplexity key on the default base URL.
// GPT models require AI_BASE_URL/AI_API_KEY pointed at OpenRouter or OpenAI.
export const ALLOWED_MODELS = [
  "sonar",
  "sonar-pro",
  "openai/gpt-5.5",
  "openai/gpt-5.4-nano",
];

/** Pick a valid model: requested (if allowed) -> env default -> first allowed. */
export function resolveModel(requested: unknown, env: Env): string {
  if (typeof requested === "string" && ALLOWED_MODELS.includes(requested)) return requested;
  return env.PERPLEXITY_MODEL || ALLOWED_MODELS[0];
}
