import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  CalendarDays,
  ChartCandlestick,
  Database,
  Loader2,
  Radio,
  Search,
} from "lucide-react";
import { api, PriceBar, Profile, SearchHit } from "../lib/api";
import { fmtNum } from "../lib/format";

const PERIODS = [
  { label: "1か月", days: 30 },
  { label: "3か月", days: 90 },
  { label: "6か月", days: 180 },
  { label: "1年", days: 365 },
  { label: "5年", days: 365 * 5 },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ChartPage() {
  const [params, setParams] = useSearchParams();
  const symbolParam = (params.get("symbol") || "AAPL").toUpperCase();

  const [query, setQuery] = useState(symbolParam);
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [rangeDays, setRangeDays] = useState(365);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Create the chart once (kept as before: lightweight-charts).
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

  // Fetch history + profile when symbol or range changes.
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

  // Sync the search box when the symbol changes externally.
  useEffect(() => {
    setQuery(symbolParam);
    setSuggestions([]);
  }, [symbolParam]);

  // Debounced symbol suggestions (only when the box differs from the symbol).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q.toUpperCase() === symbolParam) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => setSuggestions(r.data.slice(0, 8)))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [query, symbolParam]);

  const asc = useMemo(
    () => (bars ? [...bars].filter((b) => b && b.date).sort((a, b) => (a.date < b.date ? -1 : 1)) : []),
    [bars]
  );

  // Render bars into the chart.
  useEffect(() => {
    if (!candleRef.current || !volRef.current) return;
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
  }, [asc]);

  const last = asc.length ? asc[asc.length - 1] : null;
  const stats = useMemo(() => {
    if (asc.length === 0) return null;
    const first = asc[0];
    const lastBar = asc[asc.length - 1];
    const high = Math.max(...asc.map((b) => b.high));
    const low = Math.min(...asc.map((b) => b.low));
    const change = lastBar.close - first.close;
    return {
      high,
      low,
      changePct: first.close ? (change / first.close) * 100 : 0,
      avgVolume: asc.reduce((s, b) => s + b.volume, 0) / asc.length,
      days: asc.length,
    };
  }, [asc]);

  function choose(symbol: string) {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setSuggestions([]);
    setParams({ symbol: s });
  }

  return (
    <main className="page chart-page">
      <header className="page-header">
        <div className="title-cluster">
          <span className="title-icon">
            <ChartCandlestick size={18} />
          </span>
          <div>
            <h1>チャート</h1>
            <p className="subtitle">FMPの調整済み日足のローソク足と出来高を確認します。</p>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge blue">
            <Database size={11} /> FMP OHLCV
          </span>
          <span className="badge purple">
            <CalendarDays size={11} /> 日足
          </span>
          {last && (
            <span className="badge good">
              <Radio size={11} /> 最新 {last.date}
            </span>
          )}
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
                choose(query);
              }
            }}
            placeholder="シンボルまたは会社名で検索 (例: AAPL, apple)"
          />
          {suggestions.length > 0 && (
            <div className="panel search-results">
              {suggestions.map((row) => (
                <button
                  key={row.symbol}
                  type="button"
                  className="search-result"
                  onClick={() => choose(row.symbol)}
                >
                  <Search size={13} /> <strong>{row.symbol}</strong> {row.name}
                  {row.exchange && <span className="badge">{row.exchange}</span>}
                </button>
              ))}
            </div>
          )}
        </label>
        <div className="chart-tool-group">
          <span className="tool-label">表示期間</span>
          <div className="segmented">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                type="button"
                className={rangeDays === p.days ? "active" : ""}
                onClick={() => setRangeDays(p.days)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="chart-symbol-bar">
        <div>
          <div className="section-kicker">
            {symbolParam}
            {profile?.sector ? ` · ${profile.sector}` : ""}
          </div>
          <div className="chart-symbol-name">{profile?.companyName || symbolParam}</div>
        </div>
        <div className="ohlcv-strip">
          <Ohlcv label="日付" value={last?.date ?? "-"} />
          <Ohlcv label="始値" value={last ? `$${fmtNum(last.open)}` : "-"} />
          <Ohlcv label="高値" value={last ? `$${fmtNum(last.high)}` : "-"} />
          <Ohlcv label="安値" value={last ? `$${fmtNum(last.low)}` : "-"} />
          <Ohlcv label="終値" value={last ? `$${fmtNum(last.close)}` : "-"} strong />
          <Ohlcv label="出来高" value={last ? fmtNum(last.volume, 0) : "-"} />
        </div>
      </section>

      <section className="panel main-chart-panel">
        <div ref={containerRef} className="candlestick-canvas" />
        {loading && (
          <div className="chart-loading">
            <Loader2 size={18} className="spin" /> ローソク足を読み込んでいます
          </div>
        )}
        {!loading && error && <div className="chart-loading">{error}</div>}
        {!loading && !error && bars && bars.length === 0 && (
          <div className="chart-loading">
            データがありません（FMP無料プランは米国株のEOD履歴が中心です）。
          </div>
        )}
      </section>

      {stats && (
        <section className="chart-summary-grid">
          <Summary
            label="期間騰落率"
            value={`${stats.changePct >= 0 ? "+" : ""}${stats.changePct.toFixed(2)}%`}
            tone={stats.changePct >= 0 ? "positive" : "negative"}
          />
          <Summary label="期間高値" value={`$${fmtNum(stats.high)}`} />
          <Summary label="期間安値" value={`$${fmtNum(stats.low)}`} />
          <Summary label="平均出来高" value={fmtNum(stats.avgVolume, 0)} />
          <Summary label="営業日数" value={`${stats.days}日`} />
        </section>
      )}

      <div className="disclaimer">
        本画面は過去・公開データに基づく情報表示を目的としており、特定銘柄の売買を推奨するものではありません。
      </div>
    </main>
  );
}

function Ohlcv({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="ohlcv-item">
      <span>{label}</span>
      <strong className={strong ? "primary" : ""}>{value}</strong>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="summary-card">
      <div className="summary-label">{label}</div>
      <div className={`summary-value ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
