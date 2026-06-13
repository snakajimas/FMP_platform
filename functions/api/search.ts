import { Env, json, fail } from "../_lib/env";
import { fmpGet, FmpError } from "../_lib/fmp";

// GET /api/search?query=apple  -> matching ticker symbols
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const query = (new URL(request.url).searchParams.get("query") || "").trim();
  if (!query) return fail("query is required.");

  try {
    const raw = await fmpGet(env.FMP_API_KEY, "search-symbol", { query, limit: 15 });
    return json({ data: Array.isArray(raw) ? raw : [] });
  } catch (e) {
    return fail(
      e instanceof FmpError ? e.message : "Search request failed.",
      e instanceof FmpError ? e.status : 502
    );
  }
};
