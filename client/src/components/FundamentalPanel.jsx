import Meter from './Meter.jsx';

const sentColor = (s) => (s > 0.15 ? 'var(--buy)' : s < -0.15 ? 'var(--sell)' : 'var(--hold)');
const sentLabel = (s) => (s > 0.15 ? 'Bullish' : s < -0.15 ? 'Bearish' : 'Neutral');

/** Fundamental / news-sentiment panel from the LLM (or heuristic) analyzer. */
export default function FundamentalPanel({ fundamental }) {
  const { sentiment, significance, riskFlags, summary, engine, model, items } = fundamental;
  // Sentiment is -1..+1; map to 0..1 for the meter.
  const sentMeter = (sentiment + 1) / 2;

  return (
    <div className="card">
      <h3>
        Fundamental Analysis
        <span className={`badge ${engine === 'llm' ? 'llm' : ''}`} style={{ marginLeft: 10, textTransform: 'none' }}>
          {engine === 'llm' ? `LLM · ${model}` : 'Heuristic (no API key)'}
        </span>
      </h3>

      <div style={{ marginBottom: 6 }}>
        <Meter
          label={`News sentiment · ${sentLabel(sentiment)}`}
          value={sentMeter}
          display={sentiment.toFixed(2)}
          color={sentColor(sentiment)}
        />
        <Meter label="Event significance" value={significance} color="var(--accent)" />
      </div>

      {summary && <p className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>{summary}</p>}

      {riskFlags?.length > 0 && (
        <>
          <div className="muted" style={{ fontSize: 12, marginTop: 10, marginBottom: 6 }}>Risk flags</div>
          <div className="tags">
            {riskFlags.map((f, i) => <span key={i} className="tag">{f}</span>)}
          </div>
        </>
      )}

      <div className="muted" style={{ fontSize: 12, marginTop: 14 }}>
        Based on {items?.length ?? 0} recent headlines. News released while the market is closed
        is attributed to the next trading session (weekend/holiday alignment).
      </div>
    </div>
  );
}
