import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ScreenerRow } from "../lib/api";
import { getModel } from "../lib/models";
import { fmtCap, fmtNum } from "../lib/format";

const EXAMPLES = [
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

export default function ScreenerPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ScreenerRow[] | null>(null);
  const [filters, setFilters] = useState<Record<string, unknown> | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "marketCap", dir: -1 });

  async function run(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setLoading(true);
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
      setLoading(false);
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

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-5">
      {/* NL input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <label className="mb-1 block text-sm font-medium text-gray-300">
          自然言語でスクリーニング
        </label>
        <div className="flex items-end gap-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run(query);
              }
            }}
            rows={2}
            placeholder="例: 時価総額1000億ドル以上のテック株を時価総額順に20件"
            className="flex-1 resize-none rounded-lg border border-border bg-panel px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-[58px] rounded-lg bg-accent px-5 text-sm font-medium text-black disabled:opacity-40"
          >
            {loading ? "検索中…" : "検索"}
          </button>
        </div>
      </form>

      {!rows && !error && (
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuery(s);
                run(s);
              }}
              className="rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-gray-300 hover:border-accent/50 hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Interpreted filters */}
      {filters && (
        <div className="mt-3 rounded-lg border border-border bg-panel/60 p-3">
          {note && <div className="mb-2 text-sm text-gray-300">{note}</div>}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filters).map(([k, v]) => (
              <span key={k} className="rounded bg-black/30 px-2 py-0.5 text-[11px] text-accent">
                {FILTER_LABELS[k] || k}: {formatFilterValue(k, v)}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Dataframe */}
      {sorted && (
        <div className="mt-3 min-h-0 flex-1 overflow-auto">
          <div className="mb-2 text-sm text-gray-400">{sorted.length} 件ヒット</div>
          {sorted.length === 0 ? (
            <div className="mt-10 text-center text-gray-500">
              条件に一致する銘柄が見つかりませんでした。条件を緩めてお試しください。
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-bg text-left text-xs text-gray-400">
                <tr>
                  <Th>シンボル</Th>
                  <Th>会社名</Th>
                  <Th>セクター</Th>
                  <ThSort onClick={() => toggleSort("price")} active={sort.key === "price"}>
                    株価
                  </ThSort>
                  <ThSort onClick={() => toggleSort("marketCap")} active={sort.key === "marketCap"}>
                    時価総額
                  </ThSort>
                  <ThSort onClick={() => toggleSort("beta")} active={sort.key === "beta"}>
                    β
                  </ThSort>
                  <ThSort onClick={() => toggleSort("volume")} active={sort.key === "volume"}>
                    出来高
                  </ThSort>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.symbol} className="border-b border-border/60 hover:bg-panel/60">
                    <td className="py-2 font-medium text-accent">{r.symbol}</td>
                    <td className="max-w-[240px] truncate py-2 text-gray-300" title={r.companyName}>
                      {r.companyName || "—"}
                    </td>
                    <td className="py-2 text-gray-400">{r.sector || "—"}</td>
                    <td className="py-2">{r.price !== undefined ? `$${fmtNum(r.price)}` : "—"}</td>
                    <td className="py-2">{fmtCap(r.marketCap)}</td>
                    <td className="py-2">{fmtNum(r.beta)}</td>
                    <td className="py-2">{fmtNum(r.volume, 0)}</td>
                    <td className="py-2">
                      <Link
                        to={`/chart?symbol=${r.symbol}`}
                        className="text-xs text-gray-400 underline hover:text-accent"
                      >
                        チャート
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-gray-500">
            本結果は過去・公開データに基づく情報提供であり、将来の利益を保証しません。投資判断はご自身でお願いします。
          </p>
        </div>
      )}
    </div>
  );
}

function formatFilterValue(key: string, v: unknown): string {
  if (key.startsWith("marketCap") && typeof v === "number") return fmtCap(v);
  if (typeof v === "number") return fmtNum(v, 0);
  return String(v);
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-3 font-medium">{children}</th>;
}

function ThSort({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none py-2 pr-3 font-medium hover:text-gray-200 ${
        active ? "text-accent" : ""
      }`}
    >
      {children} {active ? "▾" : ""}
    </th>
  );
}
