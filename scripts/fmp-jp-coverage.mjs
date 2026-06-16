#!/usr/bin/env node
// =============================================================================
// FMP Japanese-stock coverage probe
// -----------------------------------------------------------------------------
// Systematically calls FMP "stable" endpoints against a set of well-known
// Tokyo Stock Exchange (TSE) symbols and prints a coverage report: which
// endpoints return data, which come back empty, and which are blocked by the
// plan. Intended to measure how far Japanese-equity data goes on a given plan
// (e.g. the top individual / "Ultimate" tier).
//
// Usage:
//   FMP_API_KEY=xxxx node scripts/fmp-jp-coverage.mjs
//   FMP_API_KEY=xxxx node scripts/fmp-jp-coverage.mjs 7203.T 6758.T   # custom symbols
//
// Notes:
//   * Needs outbound network access to financialmodelingprep.com.
//   * Read-only GETs. No data is written anywhere except stdout / report file.
//   * Each call is rate-limited a little to be polite.
// =============================================================================

const API_KEY = process.env.FMP_API_KEY;
const BASE = "https://financialmodelingprep.com/stable";

if (!API_KEY) {
  console.error("ERROR: set FMP_API_KEY in the environment first.");
  console.error("  FMP_API_KEY=xxxx node scripts/fmp-jp-coverage.mjs");
  process.exit(1);
}

// Major TSE names (symbol, English label). Override via CLI args.
const DEFAULT_SYMBOLS = [
  ["7203.T", "Toyota Motor"],
  ["6758.T", "Sony Group"],
  ["9984.T", "SoftBank Group"],
  ["6861.T", "Keyence"],
  ["8306.T", "Mitsubishi UFJ Financial"],
  ["9432.T", "NTT"],
  ["8035.T", "Tokyo Electron"],
  ["9983.T", "Fast Retailing"],
  ["7974.T", "Nintendo"],
  ["6501.T", "Hitachi"],
];

const cliSymbols = process.argv.slice(2);
const SYMBOLS = cliSymbols.length
  ? cliSymbols.map((s) => [s, s])
  : DEFAULT_SYMBOLS;

const PRIMARY = SYMBOLS[0][0]; // symbol used for single-symbol endpoint probes

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Low-level request with classification of the result.
// ---------------------------------------------------------------------------
async function call(path, params = {}) {
  const url = new URL(`${BASE}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && `${v}` !== "") url.searchParams.set(k, `${v}`);
  }
  url.searchParams.set("apikey", API_KEY);

  try {
    const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
    const text = await res.text();
    if (/not in allowlist|egress/i.test(text)) {
      return { status: "EGRESS_BLOCKED", http: res.status, note: text.slice(0, 120) };
    }
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      return { status: "NON_JSON", http: res.status, note: text.slice(0, 120) };
    }

    if (body && typeof body === "object" && !Array.isArray(body) && "Error Message" in body) {
      const msg = String(body["Error Message"]);
      const plan = /plan|subscription|exclusive|upgrade|not available|legacy/i.test(msg);
      return { status: plan ? "PLAN_LOCKED" : "ERROR", http: res.status, note: msg.slice(0, 140) };
    }
    if (!res.ok) {
      return { status: "HTTP_ERR", http: res.status, note: String(text).slice(0, 140) };
    }

    const count = Array.isArray(body) ? body.length : body ? 1 : 0;
    return {
      status: count > 0 ? "OK" : "EMPTY",
      http: res.status,
      count,
      sample: sampleOf(body),
    };
  } catch (e) {
    return { status: "NETWORK_ERR", note: String(e).slice(0, 140) };
  }
}

function sampleOf(body) {
  const first = Array.isArray(body) ? body[0] : body;
  if (!first || typeof first !== "object") return first;
  // pick a few informative fields if present
  const keys = [
    "symbol", "name", "companyName", "price", "exchange", "exchangeShortName",
    "currency", "date", "country", "sector", "industry", "marketCap", "revenue",
    "close", "volume", "period", "calendarYear",
  ];
  const out = {};
  for (const k of keys) if (k in first) out[k] = first[k];
  // if nothing matched, just show the raw key list
  return Object.keys(out).length ? out : { _keys: Object.keys(first).slice(0, 8) };
}

// ---------------------------------------------------------------------------
// Endpoint catalog to probe. {group, name, path, params}
// ---------------------------------------------------------------------------
const sym = PRIMARY;
const ENDPOINTS = [
  // discovery / universe
  ["Discovery", "search-symbol (Toyota)", "search-symbol", { query: "Toyota" }],
  ["Discovery", "search-name (Toyota)", "search-name", { query: "Toyota" }],
  ["Discovery", "available-exchanges", "available-exchanges", {}],
  ["Discovery", "available-countries", "available-countries", {}],
  ["Discovery", "stock-list (full universe)", "stock-list", {}],
  ["Discovery", "financial-statement-symbol-list", "financial-statement-symbol-list", {}],

  // quotes / prices
  ["Quote", "quote", "quote", { symbol: sym }],
  ["Quote", "quote-short", "quote-short", { symbol: sym }],
  ["Price", "historical EOD full", "historical-price-eod/full", { symbol: sym, from: "2024-01-01", to: "2024-03-01" }],
  ["Price", "historical EOD light", "historical-price-eod/light", { symbol: sym }],
  ["Price", "intraday 1min", "historical-chart/1min", { symbol: sym }],
  ["Price", "intraday 1hour", "historical-chart/1hour", { symbol: sym }],

  // profile / reference
  ["Profile", "profile", "profile", { symbol: sym }],
  ["Profile", "market-capitalization", "market-capitalization", { symbol: sym }],
  ["Profile", "shares-float", "shares-float", { symbol: sym }],
  ["Profile", "stock-peers", "stock-peers", { symbol: sym }],

  // fundamentals
  ["Fundamentals", "income-statement (annual)", "income-statement", { symbol: sym, period: "annual", limit: 3 }],
  ["Fundamentals", "income-statement (quarter)", "income-statement", { symbol: sym, period: "quarter", limit: 3 }],
  ["Fundamentals", "balance-sheet-statement", "balance-sheet-statement", { symbol: sym, limit: 3 }],
  ["Fundamentals", "cash-flow-statement", "cash-flow-statement", { symbol: sym, limit: 3 }],
  ["Fundamentals", "ratios", "ratios", { symbol: sym, limit: 3 }],
  ["Fundamentals", "ratios-ttm", "ratios-ttm", { symbol: sym }],
  ["Fundamentals", "key-metrics", "key-metrics", { symbol: sym, limit: 3 }],
  ["Fundamentals", "key-metrics-ttm", "key-metrics-ttm", { symbol: sym }],
  ["Fundamentals", "financial-growth", "financial-growth", { symbol: sym, limit: 3 }],
  ["Fundamentals", "enterprise-values", "enterprise-values", { symbol: sym, limit: 3 }],

  // corporate events
  ["Events", "dividends", "dividends", { symbol: sym }],
  ["Events", "splits", "splits", { symbol: sym }],
  ["Events", "earnings", "earnings", { symbol: sym }],

  // analyst / ownership (often US-skewed)
  ["Analyst", "price-target-summary", "price-target-summary", { symbol: sym }],
  ["Analyst", "analyst-estimates", "analyst-estimates", { symbol: sym }],
  ["Analyst", "grades", "grades", { symbol: sym }],
  ["Ownership", "institutional-ownership", "institutional-ownership/symbol-positions-summary", { symbol: sym }],

  // screener for the Japanese universe
  ["Screener", "screener exchange=TSE", "company-screener", { exchange: "TSE", limit: 20, isActivelyTrading: "true" }],
  ["Screener", "screener country=JP", "company-screener", { country: "JP", limit: 20, isActivelyTrading: "true" }],
];

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const ICON = {
  OK: "✅ OK",
  EMPTY: "⚪ EMPTY",
  PLAN_LOCKED: "🔒 PLAN",
  ERROR: "❌ ERR",
  HTTP_ERR: "❌ HTTP",
  NON_JSON: "❌ JSON",
  NETWORK_ERR: "❌ NET",
  EGRESS_BLOCKED: "🚧 EGRESS",
};

async function main() {
  console.log("=".repeat(78));
  console.log("FMP Japanese-stock coverage probe");
  console.log(`Primary symbol: ${PRIMARY}   |   ${new Date().toISOString()}`);
  console.log("=".repeat(78));

  // 1) Per-endpoint catalog probe (single primary symbol)
  console.log("\n## Endpoint coverage (symbol: " + PRIMARY + ")\n");
  let lastGroup = "";
  const results = [];
  for (const [group, label, path, params] of ENDPOINTS) {
    if (group !== lastGroup) {
      console.log(`\n--- ${group} ---`);
      lastGroup = group;
    }
    const r = await call(path, params);
    results.push({ group, label, ...r });
    const tag = ICON[r.status] || r.status;
    const extra =
      r.status === "OK"
        ? `count=${r.count}  ${JSON.stringify(r.sample)}`
        : r.note
        ? r.note
        : "";
    console.log(`  ${tag.padEnd(9)} ${label.padEnd(34)} ${extra}`);
    await sleep(120);
  }

  // 2) Multi-symbol quote sweep (does each major name resolve?)
  console.log("\n## Major TSE names — quote availability\n");
  for (const [s, label] of SYMBOLS) {
    const r = await call("quote", { symbol: s });
    const tag = ICON[r.status] || r.status;
    const px =
      r.status === "OK" && r.sample
        ? `price=${r.sample.price} ${r.sample.currency ?? ""} (${r.sample.exchange ?? "?"})`
        : r.note ?? "";
    console.log(`  ${tag.padEnd(9)} ${s.padEnd(9)} ${label.padEnd(26)} ${px}`);
    await sleep(120);
  }

  // 3) Summary
  const by = {};
  for (const r of results) by[r.status] = (by[r.status] || 0) + 1;
  console.log("\n## Summary\n");
  for (const [k, v] of Object.entries(by)) console.log(`  ${ICON[k] || k}: ${v}`);
  console.log("\nLegend: ✅ data returned · ⚪ reachable but empty · 🔒 plan-locked · ❌ error");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
