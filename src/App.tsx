import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Database,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "./lib/api";
import { MODELS, getModel, setModel } from "./lib/models";

export default function App() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("fmp-sidebar-collapsed") === "true"
  );
  const [config, setConfig] = useState<{ fmp: boolean; perplexity: boolean } | null>(null);
  const [model, setModelState] = useState(getModel());

  useEffect(() => {
    localStorage.setItem("fmp-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    api.config().then(setConfig).catch(() => setConfig({ fmp: false, perplexity: false }));
  }, []);

  function changeModel(id: string) {
    setModel(id);
    setModelState(id);
  }

  const missing: string[] = [];
  if (config && !config.fmp) missing.push("FMP_API_KEY");
  if (config && !config.perplexity) missing.push("PERPLEXITY_API_KEY");

  return (
    <div className={`app-shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <TrendingUp size={17} />
          </span>
          <span className="brand-copy">
            <span className="brand-name">FMP Analytics</span>
            <span className="brand-sub">Financial Insight</span>
          </span>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={collapsed ? "サイドメニューを開く" : "サイドメニューを閉じる"}
            title={collapsed ? "サイドメニューを開く" : "サイドメニューを閉じる"}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="side-section">
          <div className="side-label">分析する</div>
          <NavLink to="/chat" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <MessageSquare size={15} />
            <span className="nav-label">AIチャット</span>
          </NavLink>
          <NavLink
            to="/screener"
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <Search size={15} />
            <span className="nav-label">スクリーナー</span>
          </NavLink>
          <NavLink to="/chart" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <BarChart3 size={15} />
            <span className="nav-label">チャート</span>
          </NavLink>
        </div>

        <div className="side-foot">
          <div className="data-health">
            <div className="health-line">
              <span
                className="health-dot"
                style={config && missing.length === 0 ? undefined : { background: "var(--yellow)" }}
              />
              {config ? (missing.length === 0 ? "API 接続OK" : "APIキー未設定") : "接続確認中"}
            </div>
            <div className="health-sub">
              Financial Modeling Prep のデータを Perplexity Agent が解説します。
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <TrendingUp size={15} />
            </span>
            FMP Analytics
          </div>
          <div className="top-title">
            自然言語で米国株のファンダ・テクニカルを、過去・公開データから客観的に分析
          </div>
          <div className="top-actions">
            <select
              className="model-select"
              value={model}
              onChange={(e) => changeModel(e.target.value)}
              title="AIモデル（チャット・スクリーナー共通）"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="status-pill">
              <Database size={12} /> FMP
            </span>
            <span className="status-pill good">
              <Sparkles size={12} /> Agent AI
            </span>
          </div>
        </header>

        {missing.length > 0 && (
          <div className="notice" style={{ margin: "10px 16px 0" }}>
            ⚠️ サーバーに未設定のキー: {missing.join(", ")} — Cloudflare の Variables and Secrets
            で設定してください。
          </div>
        )}

        <Outlet />
      </div>
    </div>
  );
}
