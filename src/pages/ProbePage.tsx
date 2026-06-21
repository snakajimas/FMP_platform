import { useState } from "react";
import { Database, FlaskConical, Loader2, Search } from "lucide-react";
import { api, ProbeResponse, ProbeSource } from "../lib/api";

// Source order + human labels. Mirrors the FMP endpoints Kabuto ingests.
const SOURCES: { key: string; label: string; endpoint: string }[] = [
  { key: "quote", label: "クォート", endpoint: "quote" },
  { key: "profile", label: "プロフィール", endpoint: "profile" },
  { key: "ratios", label: "財務レシオ", endpoint: "ratios" },
  { key: "keyMetrics", label: "主要指標", endpoint: "key-metrics" },
  { key: "income", label: "損益計算書", endpoint: "income-statement" },
  { key: "history", label: "価格履歴(1年)", endpoint: "historical-price-eod" },
];

// Quick presets to make the US vs JP comparison one click away.
const PRESETS = [
  { label: "AAPL (米)", symbol: "AAPL" },
  { label: "MSFT (米)", symbol: "MSFT" },
  { label: "7203.T (トヨタ)", symbol: "7203.T" },
  { label: "6758.T (ソニー)", symbol: "6758.T" },
];

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

function renderValue(v: unknown): string {
  if (isEmpty(v)) return "—";
  if (typeof v === "number") return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function countFields(source: ProbeSource): { total: number; populated: number } {
  if (!source.ok || !source.data || typeof source.data !== "object") {
    return { total: 0, populated: 0 };
  }
  const entries = Object.entries(source.data);
  return {
    total: entries.length,
    populated: entries.filter(([, v]) => !isEmpty(v)).length,
  };
}

export default function ProbePage() {
  const [query, setQuery] = useState("AAPL");
  const [result, setResult] = useState<ProbeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function probe(symbol: string) {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setQuery(s);
    setLoading(true);
    setError(null);
    try {
      const res = await api.probe(s);
      setResult(res);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "データ取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  // Overall coverage across every source (how complete is this symbol?).
  const totals = result
    ? SOURCES.reduce(
        (acc, s) => {
          const src = result.sources[s.key];
          if (!src) return acc;
          const { total, populated } = countFields(src);
          acc.total += total;
          acc.populated += populated;
          if (src.ok && total > 0) acc.okSources += 1;
          return acc;
        },
        { total: 0, populated: 0, okSources: 0 }
      )
    : null;

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-cluster">
          <span className="title-icon">
            <FlaskConical size={18} />
          </span>
          <div>
            <h1>データ調査</h1>
            <p className="subtitle">
              銘柄を入力すると、Kabuto が使う FMP データ群を取得します。米国株(例: AAPL)と
              日本株(例: 7203.T)で、どのフィールドがどれだけ埋まるかを比較できます。
            </p>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge blue">
            <Database size={11} /> FMP stable
          </span>
          <span className="badge purple">{SOURCES.length} エンドポイント</span>
        </div>
      </header>

      <section className="panel chart-toolbar">
        <label className="field grow">
          <span>銘柄</span>
          <input
            className="control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                probe(query);
              }
            }}
            placeholder="シンボル (米国: AAPL / 日本: 7203.T のように .T を付与)"
          />
        </label>
        <div className="chart-tool-group">
          <button
            type="button"
            className="control"
            style={{ cursor: "pointer", fontWeight: 600 }}
            onClick={() => probe(query)}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Search size={14} />} 取得
          </button>
        </div>
      </section>

      <section className="panel" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className="tool-label" style={{ alignSelf: "center" }}>
          クイック比較
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            className="badge"
            style={{ cursor: "pointer" }}
            onClick={() => probe(p.symbol)}
          >
            {p.label}
          </button>
        ))}
      </section>

      {error && (
        <div className="notice" style={{ margin: "0 0 4px" }}>
          ⚠️ {error}
        </div>
      )}

      {result && totals && (
        <section className="chart-summary-grid">
          <div className="summary-card">
            <div className="summary-label">対象</div>
            <div className="summary-value">{result.symbol}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">取得できたソース</div>
            <div className="summary-value">
              {totals.okSources}/{SOURCES.length}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">埋まったフィールド</div>
            <div className="summary-value">
              {totals.populated}/{totals.total}
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-label">充足率</div>
            <div className="summary-value">
              {totals.total ? Math.round((totals.populated / totals.total) * 100) : 0}%
            </div>
          </div>
        </section>
      )}

      {result &&
        SOURCES.map((s) => {
          const src = result.sources[s.key];
          if (!src) return null;
          const { total, populated } = countFields(src);
          const entries =
            src.ok && src.data && typeof src.data === "object"
              ? Object.entries(src.data as Record<string, unknown>)
              : [];
          return (
            <section key={s.key} className="panel" style={{ marginTop: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div className="section-kicker">
                  {s.label} <span style={{ opacity: 0.6 }}>· {s.endpoint}</span>
                </div>
                {src.ok ? (
                  <span className={`badge ${populated === 0 ? "" : "good"}`}>
                    {populated}/{total} フィールド
                  </span>
                ) : (
                  <span className="badge" style={{ color: "var(--red, #d93025)" }}>
                    取得失敗
                  </span>
                )}
              </div>

              {!src.ok && (
                <div className="health-sub">エラー: {src.error || "不明なエラー"}</div>
              )}
              {src.ok && entries.length === 0 && (
                <div className="health-sub">空のレスポンス（このソースにデータがありません）。</div>
              )}

              {entries.length > 0 && (
                <div className="probe-grid">
                  {entries.map(([k, v]) => {
                    const empty = isEmpty(v);
                    return (
                      <div
                        key={k}
                        className="probe-cell"
                        style={empty ? { opacity: 0.55 } : undefined}
                      >
                        <span className="probe-key">{k}</span>
                        <span className="probe-val">
                          {renderValue(v)}
                          {empty && (
                            <span className="badge" style={{ marginLeft: 6 }}>
                              欠損
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

      <div className="disclaimer">
        本画面は FMP からのデータ取得状況を確認するための調査用ツールであり、特定銘柄の売買を推奨するものではありません。
      </div>
    </main>
  );
}
