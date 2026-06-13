import { Env, json, fail } from "../_lib/env";
import { fmpGet, FmpError } from "../_lib/fmp";

// GET /api/history?symbol=AAPL&from=2024-01-01&to=2024-12-31
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const p = new URL(request.url).searchParams;
  const symbol = (p.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return fail("symbol is required.");

  try {
    const raw = await fmpGet(env.FMP_API_KEY, "historical-price-eod/full", {
      symbol,
      from: p.get("from") || undefined,
      to: p.get("to") || undefined,
    });
    // Stable endpoint returns an array of { date, open, high, low, close, volume }.
    const rows = Array.isArray(raw) ? raw : (raw as any)?.historical ?? [];
    return json({ symbol, data: rows });
  } catch (e) {
    return fail(
      e instanceof FmpError ? e.message : "History request failed.",
      e instanceof FmpError ? e.status : 502
    );
  }
};
