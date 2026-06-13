import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ScreenerRow } from "../lib/api";
import { fmtCap, fmtNum } from "../lib/format";

const SECTORS = [
  "",
  "Technology",
  "Healthcare",
  "Financial Services",
  "Consumer Cyclical",
  "Consumer Defensive",
  "Industrials",
  "Energy",
  "Utilities",
  "Real Estate",
  "Basic Materials",
  "Communication Services",
];

interface Filters {
  marketCapMoreThan: string;
  marketCapLowerThan: string;
  priceMoreThan: string;
  priceLowerThan: string;
  betaLowerThan: string;
  volumeMoreThan: string;
  dividendMoreThan: string;
  sector: string;
  country: string;
  isEtf: boolean;
  limit: string;
}

const EMPTY: Filters = {
  marketCapMoreThan: "",
  marketCapLowerThan: "",
  priceMoreThan: "",
  priceLowerThan: "",
  betaLowerThan: "",
  volumeMoreThan: "",
  dividendMoreThan: "",
  sector: "",
  country: "US",
  isEtf: false,
  limit: "50",
};

type SortKey = "marketCap" | "price" | "beta" | "volume" | "lastAnnualDividend";

export default function ScreenerPage() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [rows, setRows] = useState<ScreenerRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "marketCap", dir: -1 });

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      (Object.keys(f) as (keyof Filters)[]).forEach((k) => {
        const v = f[k];
        if (typeof v === "boolean") {
          if (v) params[k] = "true";
        } else if (v !== "") {
          params[k] = v;
        }
      });
      const res = await api.screener(params);
      setRows(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "スクリーニングに失敗しました。");
      setRows(null);
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
    <div className="flex h-full">
      {/* Filter panel */}
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">フィルター条件</h2>

        <Field label="セクター">
          <select
            value={f.sector}
            onChange={(e) => set("sector", e.target.value)}
            className="input"
          >
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s || "(すべて)"}
              </option>
            ))}
          </select>
        </Field>

        <Range
          label="時価総額 ($)"
          minVal={f.marketCapMoreThan}
          maxVal={f.marketCapLowerThan}
          onMin={(v) => set("marketCapMoreThan", v)}
          onMax={(v) => set("marketCapLowerThan", v)}
          placeholderMin="1000000000"
          placeholderMax=""
        />
        <Range
          label="株価 ($)"
          minVal={f.priceMoreThan}
          maxVal={f.priceLowerThan}
          onMin={(v) => set("priceMoreThan", v)}
          onMax={(v) => set("priceLowerThan", v)}
        />

        <Field label="出来高 下限">
          <input
            className="input"
            value={f.volumeMoreThan}
            onChange={(e) => set("volumeMoreThan", e.target.value)}
            placeholder="1000000"
            inputMode="numeric"
          />
        </Field>
        <Field label="配当 下限 ($/株)">
          <input
            className="input"
            value={f.dividendMoreThan}
            onChange={(e) => set("dividendMoreThan", e.target.value)}
            placeholder="0"
            inputMode="numeric"
          />
        </Field>
        <Field label="ベータ 上限">
          <input
            className="input"
            value={f.betaLowerThan}
            onChange={(e) => set("betaLowerThan", e.target.value)}
            placeholder="1.5"
            inputMode="numeric"
          />
        </Field>
        <Field label="国 (Free=US中心)">
          <input
            className="input"
            value={f.country}
            onChange={(e) => set("country", e.target.value)}
            placeholder="US"
          />
        </Field>

        <label className="my-2 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={f.isEtf}
            onChange={(e) => set("isEtf", e.target.checked)}
          />
          ETFのみ
        </label>

        <Field label="最大件数">
          <input
            className="input"
            value={f.limit}
            onChange={(e) => set("limit", e.target.value)}
            inputMode="numeric"
          />
        </Field>

        <div className="mt-3 flex gap-2">
          <button
            onClick={run}
            disabled={loading}
            className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            {loading ? "検索中…" : "スクリーニング実行"}
          </button>
          <button
            onClick={() => setF(EMPTY)}
            className="rounded-lg border border-border px-3 py-2 text-sm text-gray-300"
          >
            リセット
          </button>
        </div>
        <style>{`.input{width:100%;background:#0b0f1a;border:1px solid #1f2937;border-radius:8px;padding:6px 8px;font-size:13px;color:#e5e7eb;outline:none}.input:focus{border-color:#38bdf8}`}</style>
      </aside>

      {/* Results */}
      <section className="min-w-0 flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {!sorted && !error && (
          <div className="mt-20 text-center text-gray-500">
            左の条件を設定して「スクリーニング実行」を押してください。
          </div>
        )}
        {sorted && (
          <>
            <div className="mb-2 text-sm text-gray-400">{sorted.length} 件ヒット</div>
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
                    <td className="max-w-[220px] truncate py-2 text-gray-300" title={r.companyName}>
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
          </>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Range({
  label,
  minVal,
  maxVal,
  onMin,
  onMax,
  placeholderMin = "",
  placeholderMax = "",
}: {
  label: string;
  minVal: string;
  maxVal: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
  placeholderMin?: string;
  placeholderMax?: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <input
          className="input"
          value={minVal}
          onChange={(e) => onMin(e.target.value)}
          placeholder={placeholderMin || "下限"}
          inputMode="numeric"
        />
        <span className="text-gray-500">〜</span>
        <input
          className="input"
          value={maxVal}
          onChange={(e) => onMax(e.target.value)}
          placeholder={placeholderMax || "上限"}
          inputMode="numeric"
        />
      </div>
    </Field>
  );
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
