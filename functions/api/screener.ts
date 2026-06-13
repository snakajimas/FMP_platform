import { Env, json, fail } from "../_lib/env";
import { runScreener, FmpError } from "../_lib/fmp";

// GET /api/screener?marketCapMoreThan=...&sector=...&limit=...
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const p = new URL(request.url).searchParams;
  const args: Record<string, unknown> = {};
  for (const [k, v] of p.entries()) args[k] = v;

  try {
    const data = await runScreener(env.FMP_API_KEY, args);
    return json({ data });
  } catch (e) {
    return fail(e instanceof FmpError ? e.message : "Screener request failed.", e instanceof FmpError ? e.status : 502);
  }
};
