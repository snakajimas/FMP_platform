import { Env, json, fail } from "../_lib/env";
import { fmpGet, FmpError } from "../_lib/fmp";

// GET /api/quote?symbol=AAPL  -> latest quote + company profile
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const symbol = (new URL(request.url).searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return fail("symbol is required.");

  try {
    const [quoteRaw, profileRaw] = await Promise.all([
      fmpGet(env.FMP_API_KEY, "quote", { symbol }),
      fmpGet(env.FMP_API_KEY, "profile", { symbol }).catch(() => null),
    ]);
    const quote = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    if (!quote) return fail(`No quote found for ${symbol}.`, 404);
    return json({ symbol, quote, profile });
  } catch (e) {
    return fail(
      e instanceof FmpError ? e.message : "Quote request failed.",
      e instanceof FmpError ? e.status : 502
    );
  }
};
