import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import StockPicker from './components/StockPicker.jsx';
import PredictionCard from './components/PredictionCard.jsx';
import PriceChart from './components/PriceChart.jsx';
import TechnicalPanel from './components/TechnicalPanel.jsx';
import FundamentalPanel from './components/FundamentalPanel.jsx';
import NewsList from './components/NewsList.jsx';
import EvaluationPanel from './components/EvaluationPanel.jsx';

export default function App() {
  const [equities, setEquities] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [result, setResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('live');

  useEffect(() => {
    api.health().then(setHealth).catch(() => {});
    api.stocks()
      .then((d) => {
        setEquities(d.equities);
        if (d.source) setSource(d.source);
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  }, []);

  const runPrediction = async (ticker) => {
    setPredicting(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.predict(ticker));
    } catch (e) {
      setError(e.message);
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">📈</div>
          <div>
            <h1>StockOracle</h1>
            <div className="sub">Hybrid technical + fundamental predictions · Nigerian Exchange (NGX)</div>
          </div>
        </div>
        <div className="badges">
          {source === 'cached' ? (
            <span className="badge" title="Live scraping is unavailable from this host; serving a bundled NGX snapshot.">
              📦 Cached NGX snapshot
            </span>
          ) : (
            <span className="badge live">Live NGX data</span>
          )}
          {health && (
            <span className={`badge ${health.llm.startsWith('enabled') ? 'llm' : ''}`}>
              {health.llm.startsWith('enabled') ? '🤖 LLM analysis' : '🔤 Heuristic mode'}
            </span>
          )}
        </div>
      </header>

      <StockPicker equities={equities} loading={listLoading} onSelect={runPrediction} />

      {error && <div className="error-box">⚠ {error}</div>}

      {predicting && (
        <div className="empty">
          <div className="spinner" />
          <p style={{ marginTop: 16 }}>Collecting prices &amp; news, running technical + fundamental analysis…</p>
        </div>
      )}

      {!predicting && !result && !error && (
        <div className="empty">
          <div className="big">🔮</div>
          <p>Select a Nigerian stock above to generate a hybrid Buy / Sell prediction.</p>
          {/* <p className="muted" style={{ fontSize: 13 }}>
            Combines LSTM-style technical indicators with LLM-scored news sentiment, fused into one signal.
          </p> */}
        </div>
      )}

      {!predicting && result && (
        <div className="grid">
          <PredictionCard result={result} />

          <div className="card">
            <h3>Price · Moving Average · Bollinger Bands</h3>
            <PriceChart series={result.series} />
          </div>

          <div className="grid grid-2">
            <TechnicalPanel technical={result.technical} />
            <FundamentalPanel fundamental={result.fundamental} />
          </div>

          <div className="grid grid-2">
            <NewsList news={result.news} scoredItems={result.fundamental?.items} />
            <EvaluationPanel evaluation={result.evaluation} dataPoints={result.quote?.dataPoints} />
          </div>
        </div>
      )}

      <div className="disclaimer">
        StockOracle is an educational decision-support tool, not financial advice. Predictions are
        probabilistic and derived from public NGX price data and news sentiment. Markets are volatile —
        always do your own research before trading.
      </div>
    </div>
  );
}
