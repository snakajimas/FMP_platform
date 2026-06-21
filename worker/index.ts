import { Env, fail } from "./lib/env";
import { handleChat } from "./routes/chat";
import { handleScreenerNL } from "./routes/screener";
import { handleProbe } from "./routes/probe";
import {
  handleConfig,
  handleScreener,
  handleHistory,
  handleQuote,
  handleSearch,
} from "./routes/data";

// Single Cloudflare Worker:
//  - /api/*  -> JSON API (holds server-side FMP / Perplexity keys)
//  - else    -> static SPA assets (ASSETS binding; SPA fallback via
//               not_found_handling = "single-page-application" in wrangler.toml)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname.startsWith("/api/")) {
      try {
        return await route(pathname, request, url, env);
      } catch (e) {
        return fail(e instanceof Error ? e.message : "Internal error.", 500);
      }
    }

    // Everything else: serve the built SPA.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function route(pathname: string, request: Request, url: URL, env: Env): Promise<Response> | Response {
  switch (pathname) {
    case "/api/config":
      return handleConfig(env);
    case "/api/chat":
      return request.method === "POST"
        ? handleChat(request, env)
        : fail("Use POST for /api/chat.", 405);
    case "/api/screener":
      return handleScreener(url, env);
    case "/api/screener-nl":
      return request.method === "POST"
        ? handleScreenerNL(request, env)
        : fail("Use POST for /api/screener-nl.", 405);
    case "/api/history":
      return handleHistory(url, env);
    case "/api/quote":
      return handleQuote(url, env);
    case "/api/search":
      return handleSearch(url, env);
    case "/api/probe":
      return handleProbe(url, env);
    default:
      return fail("Not found.", 404);
  }
}
