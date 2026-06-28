/** Walk-forward backtest metrics (methodology §3.9). */
export default function EvaluationPanel({ evaluation, dataPoints }) {
  if (!evaluation?.evaluable) {
    return (
      <div className="card">
        <h3>Model Evaluation</h3>
        <p className="muted" style={{ fontSize: 13 }}>{evaluation?.reason || 'Not enough history to backtest yet.'}</p>
      </div>
    );
  }
  const c = evaluation.classification;
  const r = evaluation.regressionBaseline;
  const pct = (v) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="card">
      <h3>Model Evaluation · {evaluation.samples} backtested days</h3>
      <div className="stat-row"><span className="k">Directional accuracy</span><span className="v">{pct(c.accuracy)}</span></div>
      <div className="stat-row"><span className="k">Precision</span><span className="v">{pct(c.precision)}</span></div>
      <div className="stat-row"><span className="k">Recall</span><span className="v">{pct(c.recall)}</span></div>
      <div className="stat-row"><span className="k">F1-score</span><span className="v">{c.f1.toFixed(3)}</span></div>
      <div className="stat-row"><span className="k">RMSE (₦, baseline)</span><span className="v">{r.rmse}</span></div>
      <div className="stat-row"><span className="k">MAE (₦, baseline)</span><span className="v">{r.mae}</span></div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
        Walk-forward backtest of the technical signal over {dataPoints} stored daily bars (no lookahead).
        Accuracy improves as the history store deepens with each fetch.
      </p>
    </div>
  );
}
