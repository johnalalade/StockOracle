const fmt = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));

/** Signed signal bar: positive (bullish) grows right, negative (bearish) left. */
function SignalBar({ s }) {
  const pct = Math.abs(s.value) * 50; // half-width per side
  const up = s.value >= 0;
  return (
    <>
      <div className="sigbar">
        <span className="name">{s.name}</span>
        <div className="bar">
          <div className="mid" />
          <div className={`fill ${up ? 'up' : 'down'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="sigbar" style={{ marginTop: -6 }}>
        <span />
        <span className="detail">{s.detail}</span>
      </div>
    </>
  );
}

export default function TechnicalPanel({ technical }) {
  const ind = technical.indicators || {};
  const rsi = ind.rsi14 ?? ind.rsiAdaptive;
  return (
    <div className="card">
      <h3>Technical Analysis · {technical.direction}</h3>

      <div style={{ marginBottom: 16 }}>
        {technical.signals.map((s, i) => <SignalBar key={i} s={s} />)}
      </div>

      <div className="stat-row"><span className="k">RSI</span><span className="v">{fmt(rsi, 1)}</span></div>
      <div className="stat-row"><span className="k">SMA (fast / slow)</span>
        <span className="v">{fmt(ind.sma20 ?? ind.smaFast)} / {fmt(ind.sma50 ?? ind.smaSlow)}</span></div>
      <div className="stat-row"><span className="k">EMA 12 / 26</span>
        <span className="v">{fmt(ind.ema12)} / {fmt(ind.ema26)}</span></div>
      <div className="stat-row"><span className="k">Bollinger (U / L)</span>
        <span className="v">{fmt(ind.bbUpper ?? ind.bbAdaptiveUpper)} / {fmt(ind.bbLower ?? ind.bbAdaptiveLower)}</span></div>
      <div className="stat-row"><span className="k">Daily volatility (σ)</span>
        <span className="v">{ind.volatility10 != null ? `${(ind.volatility10 * 100).toFixed(2)}%` : '—'}</span></div>
      <div className="stat-row"><span className="k">ATR (approx.)</span><span className="v">{fmt(ind.atr14)}</span></div>
    </div>
  );
}
