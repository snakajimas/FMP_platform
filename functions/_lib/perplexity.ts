// Minimal Perplexity chat client (OpenAI-compatible /chat/completions).
// Docs: https://docs.perplexity.ai

const PPLX_URL = "https://api.perplexity.ai/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class PerplexityError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function perplexityChat(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number } = {}
): Promise<string> {
  if (!apiKey) throw new PerplexityError("PERPLEXITY_API_KEY is not configured on the server.", 500);

  const res = await fetch(PPLX_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new PerplexityError(`Perplexity returned non-JSON response (${res.status}).`, 502);
  }

  if (!res.ok) {
    const msg = body?.error?.message || body?.error || `Perplexity request failed (${res.status}).`;
    throw new PerplexityError(String(msg), res.status === 401 ? 502 : res.status);
  }

  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new PerplexityError("Perplexity response was empty.", 502);
  }
  return content;
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
