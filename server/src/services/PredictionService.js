import { getPriceHistory, getCompanyNews, resolveName } from './DataCollector.js';
import { computeIndicators } from './TechnicalIndicatorEngine.js';
import { predictTechnical } from './TechnicalModel.js';
import { analyzeFundamentals } from './LLMFundamentalAnalyzer.js';
import { fuse, explain } from './FusionModel.js';
import { backtest } from './Evaluator.js';
import { alignNewsToTradingDays } from './Preprocessor.js';

/**
 * PredictionService
 *
 * Orchestrates the full hybrid pipeline (methodology §3.8 workflow):
 * collect price + news → indicators → technical model → LLM fundamentals →
 * fusion → recommendation + explanation + backtest evaluation.
 */
export async function predict(ticker, { newsLimit = 20 } = {}) {
  const t = ticker.toUpperCase();
  const name = await resolveName(t);

  // Run market + news acquisition concurrently.
  const [history, news] = await Promise.all([
    getPriceHistory(t),
    getCompanyNews(t, name, { limit: newsLimit }),
  ]);

  if (!history.bars.length) {
    const err = new Error(`No price data available for ${t}.`);
    err.status = 404;
    throw err;
  }

  // Technical pipeline.
  const indicators = computeIndicators(history.bars);
  const technical = predictTechnical(indicators);

  // Fundamental pipeline (LLM @ temp 0, or heuristic fallback).
  const fundamental = await analyzeFundamentals(name, t, news);

  // Weekend/holiday alignment: attach each headline to the trading day it moves.
  const tradingDates = history.bars.map((b) => b.date);
  const aligned = alignNewsToTradingDays(tradingDates, news);
  const latestDay = tradingDates[tradingDates.length - 1];
  const newsForLatest = aligned.get(latestDay)?.length ?? 0;

  // Fusion + explanation.
  const fused = fuse(technical, fundamental);
  const quote = { price: history.price, asOf: latestDay };
  const explanation = explain(t, fused, technical, fundamental, quote);

  // Evaluation (walk-forward backtest of the technical signal).
  const evaluation = backtest(history.bars);

  return {
    ticker: t,
    company: name,
    sector: history.sector,
    asOf: latestDay,
    dataSource: history.source || 'live',
    quote: {
      price: history.price,
      previousClose: history.bars.length > 1 ? history.bars[history.bars.length - 2].close : null,
      dataPoints: history.bars.length,
    },
    recommendation: fused.recommendation,
    confidence: fused.confidence,
    probUp: fused.probUp,
    fusion: fused,
    technical: {
      direction: technical.direction,
      probUp: technical.probUp,
      confidence: technical.confidence,
      score: technical.score,
      signals: technical.signals,
      indicators: indicators.latest,
    },
    fundamental,
    newsAlignment: { latestTradingDay: latestDay, headlinesAttributed: newsForLatest },
    evaluation,
    explanation,
    series: indicators.series,
    news,
    generatedAt: new Date().toISOString(),
  };
}
