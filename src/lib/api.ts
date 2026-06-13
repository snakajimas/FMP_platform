// Frontend API client. All calls hit our own Pages Functions, which hold the
// server-side FMP / Perplexity keys — the browser never sees the keys.

export interface ApiError {
  error: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({ error: `Request failed (${res.status}).` }));
  if (!res.ok) throw new Error((body as ApiError).error || `Request failed (${res.status}).`);
  return body as T;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PlannedCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ChatResponse {
  answer: string;
  plan: PlannedCall[];
  results: ToolResult[];
}

export const api = {
  config: () =>
    call<{ fmp: boolean; perplexity: boolean; model: string }>("/api/config"),

  chat: (messages: ChatMessage[]) =>
    call<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),

  screener: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return call<{ data: ScreenerRow[] }>(`/api/screener?${qs}`);
  },

  history: (symbol: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ symbol });
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return call<{ symbol: string; data: PriceBar[] }>(`/api/history?${qs.toString()}`);
  },

  quote: (symbol: string) =>
    call<{ symbol: string; quote: Quote; profile: Profile | null }>(
      `/api/quote?symbol=${encodeURIComponent(symbol)}`
    ),

  search: (query: string) =>
    call<{ data: SearchHit[] }>(`/api/search?query=${encodeURIComponent(query)}`),
};

export interface ScreenerRow {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  price?: number;
  beta?: number;
  volume?: number;
  lastAnnualDividend?: number;
  exchange?: string;
  exchangeShortName?: string;
  country?: string;
  isEtf?: boolean;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercentage?: number;
  dayLow?: number;
  dayHigh?: number;
  yearLow?: number;
  yearHigh?: number;
  marketCap?: number;
  volume?: number;
  pe?: number;
  exchange?: string;
}

export interface Profile {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  description?: string;
  ceo?: string;
  country?: string;
  website?: string;
  image?: string;
}

export interface SearchHit {
  symbol: string;
  name?: string;
  exchange?: string;
  exchangeFullName?: string;
  currency?: string;
}
