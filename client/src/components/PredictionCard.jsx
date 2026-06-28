import Meter from './Meter.jsx';

const SIGNAL_COLOR = { BUY: 'var(--buy)', SELL: 'var(--sell)', HOLD: 'var(--hold)' };

/** Hero recommendation card: signal, confidence, probability, fusion weighting. */
export default function PredictionCard({ result }) {
  const { recommendation, confidence, probUp, fusion, ticker, company, quote, sector, explanation } = result;
  const price = quote?.price;
  const prev = quote?.previousClose;
  const change = price != null && prev != null ? ((price - prev) / prev) * 100 : null;

  return (
    <div className={`card reco ${recommendation}`}>
      <div className={`signal-badge ${recommendation}`}>
        {recommendation}
        <small>{(confidence * 100).toFixed(0)}% confidence</small>
      </div>

      <div className="reco-meta">
        <div className="reco-title">
          <span className="ticker">{ticker}</span>
          {price != null && <span className="price">₦{price.toLocaleString()}</span>}
          {change != null && (
            <span className="price" style={{ color: change >= 0 ? 'var(--buy)' : 'var(--sell)' }}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
        <div className="muted" style={{ fontSize: 13, marginTop: -4 }}>
          {company}{sector ? ` · ${sector}` : ''} · as of {result.asOf}
        </div>

        <Meter
          label="Probability of upward move"
          value={probUp}
          color={SIGNAL_COLOR[recommendation]}
        />
        <Meter label="Model confidence" value={confidence} color="var(--accent)" />

        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Fusion weighting · Technical {(fusion.alpha * 100).toFixed(0)}% / Fundamental{' '}
          {((1 - fusion.alpha) * 100).toFixed(0)}% · signals{' '}
          {fusion.agreement > 0.6 ? 'agree' : 'partially diverge'} ({(fusion.agreement * 100).toFixed(0)}% aligned)
        </div>

        <div className="reco-explain section-gap">{explanation}</div>
      </div>
    </div>
  );
}
