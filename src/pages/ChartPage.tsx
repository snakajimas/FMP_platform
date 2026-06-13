import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
} from "lightweight-charts";
import { api, PriceBar, Quote, Profile } from "../lib/api";
import { fmtCap, fmtNum, fmtPct } from "../lib/format";

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "5Y", days: 365 * 5 },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ChartPage() {
  const [params, setParams] = useSearchParams();
  const symbolParam = (params.get("symbol") || "AAPL").toUpperCase();

  const [input, setInput] = useState(symbolParam);
  const [rangeDays, setRangeDays] = useState(365);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Create the chart once.
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0f1a" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "#161e2e" },
        horzLines: { color: "#161e2e" },
      },
      rightPriceScale: { borderColor: "#1f2937" },
      timeScale: { borderColor: "#1f2937" },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Fetch data when symbol or range changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      try {
        const [hist, q] = await Promise.all([
          api.history(symbolParam, ymd(from), ymd(to)),
          api.quote(symbolParam).catch(() => null),
        ]);
        if (cancelled) return;
        setBars(hist.data || []);
        setQuote(q?.quote || null);
        setProfile(q?.profile || null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "データ取得に失敗しました。");
        setBars([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [symbolParam, rangeDays]);

  // Render bars into the chart.
  useEffect(() => {
    if (!bars || !candleRef.current || !volRef.current) return;
    const asc = [...bars]
      .filter((b) => b && b.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const candles: CandlestickData[] = asc.map((b) => ({
      time: b.date as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    const vols: HistogramData[] = asc.map((b) => ({
      time: b.date as Time,
      value: b.volume,
      color: b.close >= b.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
    }));
    candleRef.current.setData(candles);
    volRef.current.setData(vols);
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  function submit(sym: string) {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setParams({ symbol: s });
  }

  const change = quote?.changePercentage;

  return (
    <div className="flex h-full flex-col p-4">
      {/* Header / controls */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="シンボル (例: AAPL)"
            className="w-40 rounded-lg border border-border bg-panel px-3 py-2 text-sm uppercase outline-none focus:border-accent"
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black">
            表示
          </button>
        </form>

        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={`rounded-md px-2.5 py-1.5 text-xs ${
                rangeDays === r.days
                  ? "bg-accent/15 text-accent"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quote summary */}
      <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-1 rounded-lg border border-border bg-panel px-4 py-3">
        <div>
          <div className="text-lg font-semibold">{symbolParam}</div>
          <div className="text-xs text-gray-400">
            {profile?.companyName || quote?.name || "—"}
            {profile?.sector ? ` · ${profile.sector}` : ""}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">
            {quote?.price !== undefined ? `$${fmtNum(quote.price)}` : "—"}
          </span>
          {change !== undefined && (
            <span className={change >= 0 ? "text-up" : "text-down"}>{fmtPct(change)}</span>
          )}
        </div>
        <Stat label="時価総額" value={fmtCap(quote?.marketCap)} />
        <Stat label="PER" value={fmtNum(quote?.pe)} />
        <Stat
          label="52週レンジ"
          value={
            quote?.yearLow !== undefined && quote?.yearHigh !== undefined
              ? `$${fmtNum(quote.yearLow)} – $${fmtNum(quote.yearHigh)}`
              : "—"
          }
        />
        <Stat label="出来高" value={fmtNum(quote?.volume, 0)} />
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-down/40 bg-down/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Chart */}
      <div className="relative min-h-0 flex-1 rounded-lg border border-border bg-bg">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            読み込み中…
          </div>
        )}
        {!loading && bars && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
            データがありません（FMP無料プランは米国株のEOD履歴が中心です）。
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-gray-500">
        本結果は過去・公開データに基づく情報提供であり、将来の利益を保証しません。投資判断はご自身でお願いします。
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm text-gray-200">{value}</div>
    </div>
  );
}
