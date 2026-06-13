import { Env, json, fail, hasAiKey } from "../lib/env";
import { fmpGet, runScreener, FmpError } from "../lib/fmp";

function errResponse(e: unknown, fallback: string): Response {
  return fail(
    e instanceof FmpError ? e.message : fallback,
    e instanceof FmpError ? e.status : 502
  );
}

// GET /api/config -> whether server-side keys are configured (booleans only).
export function handleConfig(env: Env): Response {
  return json({
    fmp: Boolean(env.FMP_API_KEY),
    perplexity: hasAiKey(env), // AI key present (AI_API_KEY or PERPLEXITY_API_KEY)
    baseUrl: env.AI_BASE_URL || "https://api.perplexity.ai",
    model: env.PERPLEXITY_MODEL || "sonar",
  });
}

// GET /api/screener?marketCapMoreThan=...&sector=...&limit=...
export async function handleScreener(url: URL, env: Env): Promise<Response> {
  const args: Record<string, unknown> = {};
  for (const [k, v] of url.searchParams.entries()) args[k] = v;
  try {
    const data = await runScreener(env.FMP_API_KEY, args);
    return json({ data });
  } catch (e) {
    return errResponse(e, "Screener request failed.");
  }
}

// GET /api/history?symbol=AAPL&from=...&to=...
export async function handleHistory(url: URL, env: Env): Promise<Response> {
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  if (!symbol) return fail("symbol is required.");
  try {
    const raw = await fmpGet(env.FMP_API_KEY, "historical-price-eod/full", {
      symbol,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    const rows = Array.isArray(raw) ? raw : (raw as any)?.historical ?? [];
    return json({ symbol, data: rows });
  } catch (e) {
    return errResponse(e, "History request failed.");
  }
}

// GET /api/quote?symbol=AAPL -> latest quote + company profile
export async function handleQuote(url: URL, env: Env): Promise<Response> {
  const symbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
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
    return errResponse(e, "Quote request failed.");
  }
}

// GET /api/search?query=apple -> matching ticker symbols
export async function handleSearch(url: URL, env: Env): Promise<Response> {
  const query = (url.searchParams.get("query") || "").trim();
  if (!query) return fail("query is required.");
  try {
    const raw = await fmpGet(env.FMP_API_KEY, "search-symbol", { query, limit: 15 });
    return json({ data: Array.isArray(raw) ? raw : [] });
  } catch (e) {
    return errResponse(e, "Search request failed.");
  }
}
