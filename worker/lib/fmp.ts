// Thin wrapper around the Financial Modeling Prep "stable" API.
// Docs: https://site.financialmodelingprep.com/developer/docs/stable
// Free plan: ~250 req/day, US equities, EOD history, profiles & fundamentals.

const FMP_BASE = "https://financialmodelingprep.com/stable";

export class FmpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Low-level GET against an FMP stable endpoint. */
export async function fmpGet(
  apiKey: string,
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<unknown> {
  if (!apiKey) throw new FmpError("FMP_API_KEY is not configured on the server.", 500);

  const url = new URL(`${FMP_BASE}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") url.searchParams.set(k, `${v}`);
  }
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new FmpError(`FMP returned non-JSON response (${res.status}).`, 502);
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "Error Message" in body
        ? (body as Record<string, unknown>)["Error Message"]
        : null) || `FMP request failed (${res.status}).`;
    throw new FmpError(String(msg), res.status === 401 || res.status === 403 ? 502 : res.status);
  }

  // FMP sometimes returns { "Error Message": ... } with HTTP 200.
  if (body && typeof body === "object" && !Array.isArray(body) && "Error Message" in body) {
    throw new FmpError(String((body as Record<string, unknown>)["Error Message"]), 502);
  }

  return body;
}

// ---------------------------------------------------------------------------
// Tool registry: the AI planner picks tools by name; the executor runs them.
// Each tool maps a small, validated param set to an FMP request.
// ---------------------------------------------------------------------------

export interface FmpTool {
  name: string;
  description: string;
  /** human-readable parameter hint shown to the planner model */
  params: string;
  run: (apiKey: string, args: Record<string, unknown>) => Promise<unknown>;
}

const str = (v: unknown): string | undefined =>
  v === undefined || v === null || `${v}`.trim() === "" ? undefined : `${v}`.trim();
const upper = (v: unknown): string | undefined => str(v)?.toUpperCase();
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const FMP_TOOLS: Record<string, FmpTool> = {
  search: {
    name: "search",
    description: "Find ticker symbols by company name or partial symbol.",
    params: "query (string)",
    run: (key, a) => fmpGet(key, "search-symbol", { query: str(a.query) }),
  },
  quote: {
    name: "quote",
    description: "Latest price quote: price, change, day range, volume, market cap, PE.",
    params: "symbol (string, e.g. AAPL)",
    run: (key, a) => fmpGet(key, "quote", { symbol: upper(a.symbol) }),
  },
  profile: {
    name: "profile",
    description: "Company profile: sector, industry, description, CEO, country, beta, market cap.",
    params: "symbol (string)",
    run: (key, a) => fmpGet(key, "profile", { symbol: upper(a.symbol) }),
  },
  historical_price: {
    name: "historical_price",
    description: "End-of-day OHLCV price history for charting / returns.",
    params: "symbol (string), from (YYYY-MM-DD, optional), to (YYYY-MM-DD, optional)",
    run: (key, a) =>
      fmpGet(key, "historical-price-eod/full", {
        symbol: upper(a.symbol),
        from: str(a.from),
        to: str(a.to),
      }),
  },
  income_statement: {
    name: "income_statement",
    description: "Income statement (revenue, net income, EPS, margins) by year/quarter.",
    params: "symbol (string), period ('annual'|'quarter', optional), limit (number, optional)",
    run: (key, a) =>
      fmpGet(key, "income-statement", {
        symbol: upper(a.symbol),
        period: str(a.period),
        limit: num(a.limit) ?? 5,
      }),
  },
  balance_sheet: {
    name: "balance_sheet",
    description: "Balance sheet statement (assets, liabilities, equity, debt).",
    params: "symbol (string), period ('annual'|'quarter', optional), limit (number, optional)",
    run: (key, a) =>
      fmpGet(key, "balance-sheet-statement", {
        symbol: upper(a.symbol),
        period: str(a.period),
        limit: num(a.limit) ?? 5,
      }),
  },
  cash_flow: {
    name: "cash_flow",
    description: "Cash flow statement (operating, investing, financing, free cash flow).",
    params: "symbol (string), period ('annual'|'quarter', optional), limit (number, optional)",
    run: (key, a) =>
      fmpGet(key, "cash-flow-statement", {
        symbol: upper(a.symbol),
        period: str(a.period),
        limit: num(a.limit) ?? 5,
      }),
  },
  ratios: {
    name: "ratios",
    description: "Financial ratios (PE, PB, ROE, ROA, current ratio, debt/equity, margins).",
    params: "symbol (string), period ('annual'|'quarter', optional), limit (number, optional)",
    run: (key, a) =>
      fmpGet(key, "ratios", {
        symbol: upper(a.symbol),
        period: str(a.period),
        limit: num(a.limit) ?? 1,
      }),
  },
  key_metrics: {
    name: "key_metrics",
    description: "Key valuation metrics (market cap, enterprise value, P/E, P/B, dividend yield).",
    params: "symbol (string), period ('annual'|'quarter', optional), limit (number, optional)",
    run: (key, a) =>
      fmpGet(key, "key-metrics", {
        symbol: upper(a.symbol),
        period: str(a.period),
        limit: num(a.limit) ?? 1,
      }),
  },
  screener: {
    name: "screener",
    description:
      "Filter the stock universe by fundamentals. Use for 'find stocks where ...' questions.",
    params:
      "marketCapMoreThan, marketCapLowerThan, priceMoreThan, priceLowerThan, betaMoreThan, betaLowerThan, volumeMoreThan, dividendMoreThan, sector, industry, country (default USA), exchange, isEtf (bool), limit (number, default 30) — all optional",
    run: (key, a) => runScreener(key, a),
  },
};

export function runScreener(apiKey: string, a: Record<string, unknown>): Promise<unknown> {
  return fmpGet(apiKey, "company-screener", {
    marketCapMoreThan: num(a.marketCapMoreThan),
    marketCapLowerThan: num(a.marketCapLowerThan),
    priceMoreThan: num(a.priceMoreThan),
    priceLowerThan: num(a.priceLowerThan),
    betaMoreThan: num(a.betaMoreThan),
    betaLowerThan: num(a.betaLowerThan),
    volumeMoreThan: num(a.volumeMoreThan),
    dividendMoreThan: num(a.dividendMoreThan),
    sector: str(a.sector),
    industry: str(a.industry),
    country: str(a.country),
    exchange: str(a.exchange),
    isEtf: a.isEtf === true || a.isEtf === "true" ? "true" : undefined,
    isActivelyTrading: "true",
    limit: num(a.limit) ?? 30,
  });
}

/** Compact tool catalog string passed to the planner model. */
export function toolCatalog(): string {
  return Object.values(FMP_TOOLS)
    .map((t) => `- ${t.name}: ${t.description}\n    params: ${t.params}`)
    .join("\n");
}
