import { Env, json, fail, getLlmConfig } from "../lib/env";
import { runScreener, FmpError } from "../lib/fmp";
import { llmChat, extractJson, ChatMessage, LlmError } from "../lib/llm";
import { resolveModel } from "../lib/models";

const SECTORS = [
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
  "Communication Services",
];

// Only these keys are forwarded to FMP's company-screener.
const ALLOWED_PARAMS = new Set([
  "marketCapMoreThan",
  "marketCapLowerThan",
  "priceMoreThan",
  "priceLowerThan",
  "betaMoreThan",
  "betaLowerThan",
  "volumeMoreThan",
  "dividendMoreThan",
  "sector",
  "industry",
  "country",
  "exchange",
  "isEtf",
  "limit",
]);

interface PlanShape {
  params?: Record<string, unknown>;
  note?: string;
}

// POST /api/screener-nl  { query, model }
// Natural language -> AI -> FMP company-screener params -> rows ("dataframe").
export async function handleScreenerNL(request: Request, env: Env): Promise<Response> {
  let payload: { query?: string; model?: string };
  try {
    payload = await request.json();
  } catch {
    return fail("Invalid JSON body.");
  }
  const query = (payload.query || "").trim();
  if (!query) return fail("query is required.");

  const model = resolveModel(payload.model, env);
  const llm = getLlmConfig(env);

  const system: ChatMessage = {
    role: "system",
    content:
      "You translate a natural-language stock screening request (often Japanese) into parameters for " +
      "the Financial Modeling Prep company-screener API.\n" +
      "Output ONLY a JSON object: {\"params\": {...}, \"note\": \"<short Japanese explanation of how you interpreted the request>\"}.\n" +
      "Allowed params (omit any you don't need):\n" +
      "- marketCapMoreThan, marketCapLowerThan (USD, plain number)\n" +
      "- priceMoreThan, priceLowerThan (USD)\n" +
      "- betaMoreThan, betaLowerThan\n" +
      "- volumeMoreThan (shares)\n" +
      "- dividendMoreThan (USD per share, annual)\n" +
      "- sector (EXACTLY one of: " +
      SECTORS.join(", ") +
      ")\n" +
      "- industry (free text, optional)\n" +
      "- country (2-letter, default US; FMP free plan is US-centric)\n" +
      "- exchange (e.g. NASDAQ, NYSE)\n" +
      "- isEtf (true/false)\n" +
      "- limit (number of results, default 30, max 100)\n" +
      "Rules: Convert magnitudes correctly (e.g. '時価総額1000億ドル以上' -> marketCapMoreThan: 100000000000; " +
      "'1兆ドル' -> 1000000000000; '10億ドル' -> 1000000000). Map Japanese sector words to the exact English sector. " +
      "If the request is vague, choose reasonable filters and explain them in 'note'. Always set a limit.",
  };
  const user: ChatMessage = { role: "user", content: query };

  let plan: PlanShape | null = null;
  try {
    const raw = await llmChat(llm, model, [system, user]);
    plan = extractJson<PlanShape>(raw);
  } catch (e) {
    const status = e instanceof LlmError ? e.status : 502;
    return fail(e instanceof Error ? e.message : "AI interpretation failed.", status);
  }

  if (!plan || !plan.params || typeof plan.params !== "object") {
    return fail("AIが条件を解釈できませんでした。表現を変えてお試しください。", 422);
  }

  // Sanitize to the allowlist.
  const filters: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(plan.params)) {
    if (ALLOWED_PARAMS.has(k) && v !== null && v !== undefined && `${v}` !== "") filters[k] = v;
  }
  if (filters.country === undefined) filters.country = "US";
  if (filters.limit === undefined) filters.limit = 30;

  try {
    const data = await runScreener(env.FMP_API_KEY, filters);
    return json({ filters, note: plan.note || "", data });
  } catch (e) {
    return fail(
      e instanceof FmpError ? e.message : "Screener request failed.",
      e instanceof FmpError ? e.status : 502
    );
  }
}
