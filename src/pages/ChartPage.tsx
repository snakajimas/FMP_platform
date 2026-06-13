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
import { BarChart3, Loader2, Search } from "lucide-react";
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
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#5f6368",
        fontFamily: 'Inter, "Noto Sans JP", sans-serif',
      },
      grid: {
        vertLines: { color: "#f1f3f4" },
        horzLines: { color: "#f1f3f4" },
      },
      rightPriceScale: { borderColor: "#e8eaed" },
      timeScale: { borderColor: "#e8eaed" },
      crosshair: { mode: 1 },
      autoSize: true,
    });
    const candle = chart.addCandlestickSeries({
      upColor: "#1e8e3e",
      downColor: "#d93025",
      borderVisible: false,
      wickUpColor: "#1e8e3e",
      wickDownColor: "#d93025",
    });
    const vol = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

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
    const asc = [...bars].filter((b) => b && b.date).sort((a, b) => (a.date < b.date ? -1 : 1));

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
      color: b.close >= b.open ? "rgba(30,142,62,0.35)" : "rgba(217,48,37,0.35)",
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
  const changeClass = change === undefined ? "" : change >= 0 ? "positive" : "negative";

  return (
    <main className="page chart-page">
      <header className="page-header">
        <div className="title-cluster">
          <span className="title-icon">
            <BarChart3 size={18} />
          </span>
          <div>
            <h1>チャート</h1>
            <p className="subtitle">FMPの日足EODデータでローソク足・出来高・主要指標を表示します。</p>
          </div>
        </div>
        <div className="header-badges">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            style={{ display: "flex", gap: 6 }}
          >
            <input
              className="control"
              style={{ width: 150, height: 31 }}
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="シンボル (例: AAPL)"
            />
            <button className="detail-link" type="submit" style={{ border: 0 }}>
              <Search size={13} /> 表示
            </button>
          </form>
        </div>
      </header>

      {/* Symbol bar + OHLCV-style summary */}
      <div className="chart-symbol-bar">
        <div>
          <div className="section-kicker">{symbolParam}</div>
          <div className="chart-symbol-name">{profile?.companyName || quote?.name || symbolParam}</div>
          <div className="price-meta">
            {profile?.sector || "—"}
            {profile?.industry ? ` · ${profile.industry}` : ""}
          </div>
        </div>
        <div className="ohlcv-strip">
          <div className="ohlcv-item">
            <span>価格</span>
            <strong className="primary">
              {quote?.price !== undefined ? `$${fmtNum(quote.price)}` : "—"}
            </strong>
          </div>
          <div className="ohlcv-item">
            <span>前日比</span>
            <strong className={changeClass}>{fmtPct(change)}</strong>
          </div>
          <div className="ohlcv-item">
            <span>出来高</span>
            <strong>{fmtNum(quote?.volume, 0)}</strong>
          </div>
        </div>
      </div>

      {/* Range selector */}
      <section className="chart-toolbar panel" style={{ marginTop: 0, borderRadius: "0 0 10px 10px", borderTop: 0 }}>
        <div className="chart-tool-group">
          <span className="tool-label">期間</span>
          <div className="segmented">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={rangeDays === r.days ? "active" : ""}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="notice error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* Chart */}
      <section className="panel main-chart-panel" style={{ marginTop: 12 }}>
        <div ref={containerRef} className="candlestick-canvas" />
        {loading && (
          <div className="chart-loading">
            <Loader2 size={14} className="spin" /> 読み込み中…
          </div>
        )}
        {!loading && bars && bars.length === 0 && (
          <div className="chart-loading">
            データがありません（FMP無料プランは米国株のEOD履歴が中心です）。
          </div>
        )}
      </section>

      {/* Summary metrics */}
      <div className="chart-summary-grid">
        <Metric label="時価総額" value={fmtCap(quote?.marketCap)} />
        <Metric label="PER" value={fmtNum(quote?.pe)} />
        <Metric
          label="52週高値"
          value={quote?.yearHigh !== undefined ? `$${fmtNum(quote.yearHigh)}` : "—"}
        />
        <Metric
          label="52週安値"
          value={quote?.yearLow !== undefined ? `$${fmtNum(quote.yearLow)}` : "—"}
        />
        <Metric
          label="日中レンジ"
          value={
            quote?.dayLow !== undefined && quote?.dayHigh !== undefined
              ? `$${fmtNum(quote.dayLow)}–${fmtNum(quote.dayHigh)}`
              : "—"
          }
        />
      </div>

      <div className="disclaimer">
        本結果は過去・公開データに基づく情報提供であり、将来の利益を保証しません。投資判断はご自身でお願いします。
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className="summary-value" style={{ fontSize: 15 }}>
        {value}
      </div>
    </div>
  );
}
