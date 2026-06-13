import { Env, json } from "../_lib/env";

// GET /api/config -> tells the UI whether server-side keys are configured
// (booleans only; never exposes the keys themselves).
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return json({
    fmp: Boolean(env.FMP_API_KEY),
    perplexity: Boolean(env.PERPLEXITY_API_KEY),
    model: env.PERPLEXITY_MODEL || "sonar",
  });
};
