// Perplexity Agent API client.
// POST {baseUrl}/agent  (baseUrl = https://api.perplexity.ai/v1)
// The Agent API uses a single Perplexity key but can route to OpenAI/Anthropic
// models via the "provider/model" id (e.g. "openai/gpt-5.5").
// Docs: https://docs.perplexity.ai/docs/agent-api/quickstart
//       https://docs.perplexity.ai/docs/agent-api/openai-compatibility
//
// Request : { model, input }            (input is a STRING, not a messages array)
// Response: { output_text, output, ... } (assistant text is in output_text)

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
}

export class LlmError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Send a prompt to the Agent API. We keep a familiar messages[] interface and
 * fold it into the Agent API's single `input` string (system content first).
 */
export async function llmChat(
  config: LlmConfig,
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  if (!config.apiKey) {
    throw new LlmError("PERPLEXITY_API_KEY is not configured on the server.", 500);
  }

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => m.content)
    .join("\n\n");
  const input = system ? `${system}\n\n---\n\n${rest}` : rest;

  const url = `${config.baseUrl.replace(/\/$/, "")}/agent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new LlmError(`AI provider returned non-JSON response (${res.status}).`, 502);
  }

  if (!res.ok) {
    const msg = body?.error?.message || body?.error || `AI request failed (${res.status}).`;
    throw new LlmError(String(msg), res.status === 401 ? 502 : res.status);
  }

  const content = extractText(body);
  if (!content) throw new LlmError("AI response was empty.", 502);
  return content;
}

/** Pull assistant text out of an Agent API response (output_text or output[]). */
function extractText(body: any): string {
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }
  // Fallback: walk the output array for message text parts.
  if (Array.isArray(body?.output)) {
    let acc = "";
    for (const item of body.output) {
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c?.text === "string") acc += c.text;
        }
      }
    }
    if (acc.trim()) return acc;
  }
  return "";
}

/** Extract the first JSON object/array found in a model response. */
export function extractJson<T = unknown>(raw: string): T | null {
  // Strip ```json ... ``` fences if present.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;

  // Find the first balanced { ... } or [ ... ].
  const start = candidate.search(/[{[]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
