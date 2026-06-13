import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { api, ScreenerRow } from "../lib/api";
import { getModel } from "../lib/models";
import { fmtCap, fmtNum } from "../lib/format";

const SAMPLES = [
  "時価総額1000億ドル以上のテクノロジー株を時価総額順に20件",
  "配当利回りが高めで時価総額500億ドル超のヘルスケア銘柄",
  "株価50ドル未満・出来高100万株以上の値動きが大きい銘柄",
  "NASDAQ上場で時価総額1兆ドル超の大型株",
];

const FILTER_LABELS: Record<string, string> = {
  marketCapMoreThan: "時価総額 ≥",
  marketCapLowerThan: "時価総額 ≤",
  priceMoreThan: "株価 ≥",
  priceLowerThan: "株価 ≤",
  betaMoreThan: "β ≥",
  betaLowerThan: "β ≤",
  volumeMoreThan: "出来高 ≥",
  dividendMoreThan: "配当 ≥",
  sector: "セクター",
  industry: "業種",
  country: "国",
  exchange: "取引所",
  isEtf: "ETF",
  limit: "最大件数",
};

type SortKey = "marketCap" | "price" | "beta" | "volume";

function formatFilterValue(key: string, v: unknown): string {
  if (key.startsWith("marketCap") && typeof v === "number") return fmtCap(v);
  if (typeof v === "number") return fmtNum(v, 0);
  return String(v);
}

export default function ScreenerPage() {
  const [query, setQuery] = useState(SAMPLES[0]);
  const [rows, setRows] = useState<ScreenerRow[] | null>(null);
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "marketCap", dir: -1 });

  async function run(text = query) {
    const q = text.trim();
    if (!q || running) return;
    setQuery(text);
    setRunning(true);
    setError(null);
    try {
      const res = await api.screenerNL(q, getModel());
      setRows(res.data || []);
      setFilters(res.filters || {});
      setNote(res.note || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "スクリーニングに失敗しました。");
      setRows(null);
      setFilters(null);
    } finally {
      setRunning(false);
    }
  }

  const sorted = rows
    ? [...rows].sort((a, b) => {
        const av = (a[sort.key] as number) ?? -Infinity;
        const bv = (b[sort.key] as number) ?? -Infinity;
        return (av - bv) * sort.dir;
      })
    : null;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  }

  const sortMark = (key: SortKey) => (sort.key === key ? " ▾" : "");

  return (
    <main className="page chart-page">
      <header className="page-header">
        <div className="title-cluster">
          <span className="title-icon">
            <Search size={18} />
          </span>
          <div>
            <h1>AIスクリーナー</h1>
            <p className="subtitle">
              自然言語の条件をAIがFMPの絞り込みパラメータに変換し、米国株のデータフレームを出力します。
            </p>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge purple">
            <Sparkles size={11} /> Perplexity Agent
          </span>
          <span className="badge blue">
            <Database size={11} /> FMP company-screener
          </span>
        </div>
      </header>

      <section className="panel hero-grid">
        <div>
          <div className="section-kicker">スクリーニング条件</div>
          <textarea
            className="prompt-box"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void run();
            }}
            placeholder="例: 時価総額1000億ドル以上のテック株を時価総額順に20件 / 配当利回りの高い大型ヘルスケア株"
          />
          <div className="chips">
            {SAMPLES.map((s) => (
              <button
                key={s}
                className="chip"
                type="button"
                disabled={running}
                onClick={() => void run(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="run-cluster">
          <button
            className="primary-button"
            type="button"
            disabled={running || !query.trim()}
            onClick={() => void run()}
          >
            {running ? <Loader2 size={15} className="spin" /> : <WandSparkles size={15} />}
            {running ? "AIが抽出中" : "AIで銘柄を抽出"}
          </button>
        </div>
      </section>

      {error && (
        <div className="notice error">
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      <section className="summary-grid">
        <div className="summary-card">
          <div className="summary-label">ヒット件数</div>
          <div className="summary-value purple">
            {sorted ? `${sorted.length.toLocaleString()}件` : "-"}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">適用フィルタ数</div>
          <div className="summary-value">{filters ? Object.keys(filters).length : "-"}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">データソース</div>
          <div className="summary-value">FMP</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">対象市場</div>
          <div className="summary-value">米国株</div>
        </div>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-head">
            <div className="panel-title">
              <Search size={13} /> 抽出結果
            </div>
            {sorted && (
              <div className="result-toolbar">
                <span className="result-count">
                  <strong>{sorted.length.toLocaleString()}</strong> 件を表示
                </span>
              </div>
            )}
          </div>
          {sorted && sorted.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>シンボル</th>
                    <th>会社名</th>
                    <th>セクター</th>
                    <th className="sortable" onClick={() => toggleSort("price")}>
                      株価{sortMark("price")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("marketCap")}>
                      時価総額{sortMark("marketCap")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("beta")}>
                      β{sortMark("beta")}
                    </th>
                    <th className="sortable" onClick={() => toggleSort("volume")}>
                      出来高{sortMark("volume")}
                    </th>
                    <th> </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, i) => (
                    <tr key={r.symbol}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <Link className="symbol-link" to={`/chart?symbol=${r.symbol}`}>
                          {r.symbol}
                        </Link>
                      </td>
                      <td>
                        <div className="company-name" title={r.companyName}>
                          {r.companyName || "-"}
                        </div>
                      </td>
                      <td>{r.sector ? <span className="badge">{r.sector}</span> : "-"}</td>
                      <td>{r.price !== undefined ? `$${fmtNum(r.price)}` : "-"}</td>
                      <td>{fmtCap(r.marketCap)}</td>
                      <td>{fmtNum(r.beta)}</td>
                      <td>{fmtNum(r.volume, 0)}</td>
                      <td>
                        <Link className="symbol-link" to={`/chart?symbol=${r.symbol}`}>
                          チャート
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <span className="empty-icon">
                  <Search size={20} />
                </span>
                {sorted
                  ? "条件に合う銘柄がありません。表現や閾値を少し緩めてください。"
                  : "投資アイデアを自然言語で入力し、「AIで銘柄を抽出」を押してください。"}
              </div>
            </div>
          )}
        </section>

        <aside className="side-stack">
          {note && (
            <section className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <Sparkles size={13} /> AIの解釈
                </div>
              </div>
              <div className="panel-body thought-box">{note}</div>
            </section>
          )}

          {filters && Object.keys(filters).length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <CheckCircle2 size={13} /> 適用フィルタ
                </div>
              </div>
              <div className="panel-body explain-list">
                {Object.entries(filters).map(([k, v]) => (
                  <div className="explain-item" key={k}>
                    <CheckCircle2 size={13} />
                    <span>
                      {FILTER_LABELS[k] || k}: <strong>{formatFilterValue(k, v)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="notice">
            <ShieldAlert size={12} />
            抽出結果は過去・公開データに基づく客観的な候補表示であり、将来の成果や売買判断を保証するものではありません。
          </div>
        </aside>
      </div>
    </main>
  );
}
