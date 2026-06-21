import { Env, json, fail } from "../lib/env";
import { fmpGet, FmpError } from "../lib/fmp";

// Data-coverage probe: fetch the bundle of FMP endpoints that Kabuto relies on
// for a single symbol, so we can see how much of it is actually populated for
// US vs JP tickers. Each source is fetched independently — one endpoint
// returning nothing (common for non-US symbols) is itself the signal we want,
// so it must not fail the whole probe.

interface SourceResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

async function one(
  fn: () => Promise<unknown>,
  pick: "first" | "raw" = "first"
): Promise<SourceResult> {
  try {
    const raw = await fn();
    const data = pick === "first" ? (Array.isArray(raw) ? raw[0] ?? null : raw ?? null) : raw;
    return { ok: true, data: data ?? null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof FmpError ? e.message : "request failed",
      data: null,
    };
  }
}

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

// GET /api/probe?symbol=AAPL  (JP example: 7203.T)
export async function handleProbe(url: URL, env: Env): Promise<Response> {
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return fail("symbol is required.");
  const key = env.FMP_API_KEY;

  // ~1y window: enough to judge price-history availability without a huge payload.
  const to = new Date();
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);

  const [quote, profile, ratios, keyMetrics, income, historyRes] = await Promise.all([
    one(() => fmpGet(key, "quote", { symbol })),
    one(() => fmpGet(key, "profile", { symbol })),
    one(() => fmpGet(key, "ratios", { symbol, limit: 1 })),
    one(() => fmpGet(key, "key-metrics", { symbol, limit: 1 })),
    one(() => fmpGet(key, "income-statement", { symbol, limit: 1 })),
    one(
      () => fmpGet(key, "historical-price-eod/full", { symbol, from: ymd(from), to: ymd(to) }),
      "raw"
    ),
  ]);

  // Summarize price history instead of returning every bar.
  let history: SourceResult;
  if (historyRes.ok) {
    const d = historyRes.data as unknown;
    const rows: any[] = Array.isArray(d) ? d : (d as any)?.historical ?? [];
    const sorted = rows.filter((r) => r && r.date).sort((a, b) => (a.date < b.date ? -1 : 1));
    history = {
      ok: true,
      data: sorted.length
        ? {
            bars: sorted.length,
            from: sorted[0].date,
            to: sorted[sorted.length - 1].date,
            lastClose: sorted[sorted.length - 1].close,
            lastVolume: sorted[sorted.length - 1].volume,
          }
        : { bars: 0 },
    };
  } else {
    history = historyRes;
  }

  return json({
    symbol,
    sources: { quote, profile, ratios, keyMetrics, income, history },
  });
}
