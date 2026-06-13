import { Env, json, fail } from "../lib/env";
import { FMP_TOOLS, toolCatalog, FmpError } from "../lib/fmp";
import { perplexityChat, extractJson, ChatMessage, PerplexityError } from "../lib/perplexity";
import { resolveModel } from "../lib/models";

interface PlannedCall {
  tool: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  data?: unknown;
  error?: string;
}

const MAX_CALLS = 5;

const DISCLAIMER =
  "本結果は過去・公開データに基づく情報提供であり、将来の利益を保証しません。投資判断はご自身でお願いします。";

/** Trim large arrays so the synthesis prompt stays within a sane token budget. */
function compact(data: unknown): unknown {
  if (Array.isArray(data)) {
    if (data.length > 25) {
      return { _truncated: true, total: data.length, sample: data.slice(0, 25) };
    }
    return data;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = compact(v);
    return out;
  }
  return data;
}

export async function handleChat(request: Request, env: Env): Promise<Response> {
  let payload: { messages?: ChatMessage[]; model?: string };
  try {
    payload = await request.json();
  } catch {
    return fail("Invalid JSON body.");
  }

  const history = (payload.messages || []).filter(
    (m) => m && typeof m.content === "string" && m.content.trim() !== ""
  );
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser) return fail("No user message provided.");

  const model = resolveModel(payload.model, env);

  // --- Step 1: plan which FMP tools to call -------------------------------
  const planSystem: ChatMessage = {
    role: "system",
    content:
      "You are the planning stage of a financial data assistant powered by the Financial Modeling Prep (FMP) API.\n" +
      "Decide which FMP tools to call to answer the user's question with real data.\n" +
      "Available tools:\n" +
      toolCatalog() +
      "\n\nRules:\n" +
      "- Resolve company names to ticker symbols yourself when obvious (Apple -> AAPL). If unsure, use the 'search' tool first.\n" +
      "- Only request data you actually need (max " +
      MAX_CALLS +
      " calls).\n" +
      "- For pure greetings or questions needing no market data, return an empty calls array.\n" +
      "- Country defaults to USA on the FMP free plan.\n" +
      'Respond with ONLY a JSON object: {"calls":[{"tool":"<name>","args":{...}}]}',
  };

  const recent = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
  const planUser: ChatMessage = {
    role: "user",
    content: `Conversation so far:\n${recent}\n\nReturn the JSON plan for: "${lastUser.content}"`,
  };

  let plan: { calls?: PlannedCall[] } | null = null;
  try {
    const planRaw = await perplexityChat(env.PERPLEXITY_API_KEY, model, [planSystem, planUser], {
      temperature: 0,
    });
    plan = extractJson<{ calls?: PlannedCall[] }>(planRaw);
  } catch (e) {
    const status = e instanceof PerplexityError ? e.status : 502;
    return fail(e instanceof Error ? e.message : "Planning step failed.", status);
  }

  const calls = (plan?.calls || []).slice(0, MAX_CALLS).filter((c) => c && FMP_TOOLS[c.tool]);

  // --- Step 2: execute FMP calls -----------------------------------------
  const results: ToolResult[] = await Promise.all(
    calls.map(async (c) => {
      try {
        const data = await FMP_TOOLS[c.tool].run(env.FMP_API_KEY, c.args || {});
        return { tool: c.tool, args: c.args || {}, ok: true, data };
      } catch (e) {
        return {
          tool: c.tool,
          args: c.args || {},
          ok: false,
          error: e instanceof FmpError ? e.message : "FMP request failed.",
        };
      }
    })
  );

  // --- Step 3: synthesize a Japanese answer grounded in the data ---------
  const dataForModel = results.map((r) => ({
    tool: r.tool,
    args: r.args,
    ...(r.ok ? { data: compact(r.data) } : { error: r.error }),
  }));

  const synthSystem: ChatMessage = {
    role: "system",
    content:
      "あなたはFMP(Financial Modeling Prep)の実データを解説する金融データアシスタントです。\n" +
      "以下のルールを厳守してください:\n" +
      "- 回答は日本語。提供されたFMPデータのみを根拠にし、数値はデータから引用する。\n" +
      "- データが取得できなかった場合は、その旨を正直に伝える(推測で数値を作らない)。\n" +
      "- 「買うべき/売るべき」などの投資推奨はしない。『過去データ上では』『この指標では』という観測事実の表現に留める。\n" +
      "- 要点を簡潔に。必要なら箇条書きや表で整理する。\n" +
      `- 回答の最後に必ず次の免責を1行で添える: 「${DISCLAIMER}」`,
  };
  const synthUser: ChatMessage = {
    role: "user",
    content:
      `ユーザーの質問: ${lastUser.content}\n\n` +
      (dataForModel.length
        ? `取得したFMPデータ(JSON):\n${JSON.stringify(dataForModel)}`
        : "(この質問にはFMPデータの取得は不要と判断されました。一般的な範囲で簡潔に答えてください。)"),
  };

  let answer: string;
  try {
    answer = await perplexityChat(env.PERPLEXITY_API_KEY, model, [synthSystem, synthUser], {
      temperature: 0.3,
    });
  } catch (e) {
    const status = e instanceof PerplexityError ? e.status : 502;
    return fail(e instanceof Error ? e.message : "Synthesis step failed.", status);
  }

  return json({ answer, plan: calls, results });
}
