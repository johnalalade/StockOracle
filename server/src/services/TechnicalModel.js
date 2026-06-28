/**
 * TechnicalModel
 *
 * Stands in for the methodology's LSTM technical predictor. Rather than
 * "training" an LSTM on the ~10–60 close-only points NGX/AFX realistically
 * exposes (which would overfit and mislead), it produces a transparent,
 * defensible directional signal by scoring the computed indicators.
 *
 * Output P_tech is the modelled probability that the next session closes UP,
 * in [0,1], plus a confidence that scales with history depth and signal
 * agreement. The fusion layer treats P_tech exactly like an LSTM's P_up,
 * so this can be swapped for a TensorFlow.js LSTM later without API changes.
 */

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * @param {object} indicators  output of computeIndicators()
 * @returns {{ probUp, direction, confidence, score, signals, dataPoints }}
 */
export function predictTechnical(indicators) {
  const { series, latest, macd } = indicators;
  const n = series.length;
  const signals = [];

  if (!latest || n < 3) {
    return {
      probUp: 0.5,
      direction: 'NEUTRAL',
      confidence: 0.1,
      score: 0,
      signals: [{ name: 'data', detail: 'Insufficient price history', weight: 0, value: 0 }],
      dataPoints: n,
    };
  }

  const close = latest.close;
  // Prefer standard windows; fall back to adaptive (short) windows when the
  // series is too shallow for the canonical periods.
  const trendFast = latest.sma20 ?? latest.sma10 ?? latest.smaFast;
  const trendSlow = latest.sma50 ?? latest.sma20 ?? latest.smaSlow;
  const rsiVal = latest.rsi14 ?? latest.rsiAdaptive;
  const rocVal = latest.roc10 ?? latest.rocAdaptive;
  const bbUp = latest.bbUpper ?? latest.bbAdaptiveUpper;
  const bbLo = latest.bbLower ?? latest.bbAdaptiveLower;

  // Each signal contributes a vote in [-1, +1] with a weight.
  const add = (name, value, weight, detail) =>
    signals.push({ name, value: clamp(value, -1, 1), weight, detail });

  // 1) Trend: price vs moving average.
  if (trendFast != null) {
    const v = clamp(((close - trendFast) / trendFast) * 12, -1, 1);
    add('price_vs_ma', v, 1.0, `Price ${close} vs MA ${trendFast.toFixed(2)}`);
  }
  if (trendSlow != null && trendFast != null) {
    const v = trendFast > trendSlow ? 0.6 : -0.6;
    add('fast_vs_slow_ma', v, 0.8, `Fast MA ${v > 0 ? 'above' : 'below'} slow MA (trend)`);
  }

  // 2) Momentum: MACD (EMA12 - EMA26) when available.
  const macdNow = macd[n - 1];
  if (macdNow != null) {
    const v = clamp((macdNow / close) * 40, -1, 1);
    add('macd', v, 0.9, `MACD ${macdNow.toFixed(2)} (${macdNow >= 0 ? 'bullish' : 'bearish'})`);
  }

  // 3) RSI: oversold = bullish, overbought = bearish, midline neutral.
  if (rsiVal != null) {
    let v;
    if (rsiVal < 30) v = 0.8; // oversold → mean-revert up
    else if (rsiVal > 70) v = -0.8; // overbought → mean-revert down
    else v = (rsiVal - 50) / 40; // mild momentum bias around midline
    add('rsi', v, 0.8, `RSI ${rsiVal.toFixed(1)}`);
  }

  // 4) Rate of change (short-term momentum).
  if (rocVal != null) {
    add('roc', clamp(rocVal / 15, -1, 1), 0.6, `ROC ${rocVal.toFixed(1)}%`);
  }

  // 5) Bollinger position (mean-reversion at the bands).
  if (bbUp != null && bbLo != null) {
    const span = bbUp - bbLo || 1;
    const posPct = ((close - bbLo) / span) * 2 - 1; // -1 lower band, +1 upper band
    add('bollinger', -posPct * 0.7, 0.5, `Band position ${posPct.toFixed(2)}`);
  }

  // Weighted vote → score in [-1, 1].
  const totalWeight = signals.reduce((s, x) => s + x.weight, 0) || 1;
  const score = signals.reduce((s, x) => s + x.value * x.weight, 0) / totalWeight;

  // Map score to probability via a logistic squash.
  const probUp = clamp(1 / (1 + Math.exp(-3.2 * score)), 0.02, 0.98);

  // Confidence: more history + stronger consensus + lower volatility ⇒ higher.
  const depthFactor = clamp((n - 5) / 45, 0, 1); // ramps up to ~50 bars
  const consensus = Math.abs(score); // 0 = mixed, 1 = unanimous
  const volPenalty = latest.volatility10 != null ? clamp(latest.volatility10 * 6, 0, 0.5) : 0.2;
  const confidence = clamp(0.25 + 0.4 * depthFactor + 0.45 * consensus - volPenalty, 0.1, 0.95);

  const direction = score > 0.06 ? 'UP' : score < -0.06 ? 'DOWN' : 'NEUTRAL';

  return {
    probUp: Number(probUp.toFixed(4)),
    direction,
    confidence: Number(confidence.toFixed(4)),
    score: Number(score.toFixed(4)),
    signals,
    dataPoints: n,
  };
}
