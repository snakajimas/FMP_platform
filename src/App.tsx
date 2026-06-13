import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "./lib/api";

const tabs = [
  { to: "/chat", label: "AIチャット", icon: "💬" },
  { to: "/screener", label: "スクリーナー", icon: "🔎" },
  { to: "/chart", label: "チャート", icon: "📈" },
];

export default function App() {
  const [config, setConfig] = useState<{ fmp: boolean; perplexity: boolean } | null>(null);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig({ fmp: false, perplexity: false }));
  }, []);

  const missing: string[] = [];
  if (config && !config.fmp) missing.push("FMP_API_KEY");
  if (config && !config.perplexity) missing.push("PERPLEXITY_API_KEY");

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐂</span>
          <span className="text-lg font-semibold tracking-tight">
            FMP <span className="text-accent">Analytics</span>
          </span>
        </div>
        <nav className="flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition ${
                  isActive ? "bg-accent/15 text-accent" : "text-gray-400 hover:text-gray-200"
                }`
              }
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto text-xs text-gray-500">
          Powered by Financial Modeling Prep + Perplexity
        </div>
      </header>

      {missing.length > 0 && (
        <div className="border-b border-amber-700/40 bg-amber-900/20 px-5 py-2 text-sm text-amber-300">
          ⚠️ サーバーに未設定のキー: {missing.join(", ")} —{" "}
          <code className="rounded bg-black/30 px-1">wrangler pages secret put …</code>{" "}
          または .dev.vars で設定してください。
        </div>
      )}

      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
