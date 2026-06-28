/**
 * TechnicalIndicatorEngine
 *
 * Computes the technical features described in the methodology:
 * returns, SMA, EMA, RSI, ROC, rolling volatility (σ), Bollinger Bands, ATR.
 *
 * NGX data from AFX is close-only (no intraday O/H/L), so range-based
 * indicators (ATR) are approximated from close-to-close movement. Every
 * indicator degrades gracefully when history is short and returns `null`
 * for positions that lack enough lookback.
 */

const last = (arr) => (arr.length ? arr[arr.length - 1] : null);

export function dailyReturns(closes) {
  const out = [null];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    out.push(prev ? (closes[i] - prev) / prev : null);
  }
  return out;
}

export function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) continue;
    if (prev === null) {
      // Seed with the SMA of the first `period` values.
      let sum = 0;
      for (let j = i - period + 1; j <= i; j += 1) sum += values[j];
      prev = sum / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI over `period` (default 14). */
export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const g = diff >= 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

/** Rate of Change (%) over `period`. */
export function roc(closes, period = 10) {
  const out = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i += 1) {
    const base = closes[i - period];
    if (base) out[i] = ((closes[i] - base) / base) * 100;
  }
  return out;
}

/** Rolling standard deviation (population) over `period`. */
export function rollingStd(values, period) {
  const out = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i += 1) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

/** Bollinger Bands: middle = SMA(period), upper/lower = middle ± k·σ. */
export function bollinger(closes, period = 20, k = 2) {
  const mid = sma(closes, period);
  const sd = rollingStd(closes, period);
  const upper = closes.map((_, i) => (mid[i] != null && sd[i] != null ? mid[i] + k * sd[i] : null));
  const lower = closes.map((_, i) => (mid[i] != null && sd[i] != null ? mid[i] - k * sd[i] : null));
  return { middle: mid, upper, lower };
}

/**
 * ATR approximated from close-to-close absolute moves (true range needs
 * intraday H/L which NGX/AFX does not expose). Smoothed with Wilder's EMA.
 */
export function atrFromClose(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  const tr = closes.map((c, i) => (i === 0 ? 0 : Math.abs(c - closes[i - 1])));
  let prev = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  out[period] = prev;
  for (let i = period + 1; i < closes.length; i += 1) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/**
 * Compute the full indicator set for a price series.
 * @param {Array<{date,close,volume}>} bars  ascending by date
 * @returns {{ series, latest }}
 */
export function computeIndicators(bars) {
  const closes = bars.map((b) => b.close);
  const n = closes.length;
  const ret = dailyReturns(closes);
  const sma5 = sma(closes, 5);
  const sma10 = sma(closes, 10);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes, 14);
  const roc10 = roc(closes, 10);
  const vol10 = rollingStd(ret.map((r) => r ?? 0), 10);
  const bb = bollinger(closes, 20, 2);
  const atr14 = atrFromClose(closes, 14);

  // Adaptive (short-window) indicators so the model still produces a real
  // signal on a shallow series (e.g. the ~10 days AFX exposes), scaling up to
  // the standard windows as the persisted history deepens.
  const fastTrend = Math.max(3, Math.min(20, Math.floor(n / 3)));
  const slowTrend = Math.max(fastTrend + 2, Math.min(50, Math.floor(n / 1.5)));
  const rsiP = Math.max(4, Math.min(14, Math.floor(n / 2) - 1));
  const rocP = Math.max(3, Math.min(10, Math.floor(n / 3)));
  const bbP = Math.max(5, Math.min(20, Math.floor(n / 2)));
  const smaFast = sma(closes, fastTrend);
  const smaSlow = sma(closes, slowTrend);
  const rsiAdaptive = rsi(closes, rsiP);
  const rocAdaptive = roc(closes, rocP);
  const bbAdaptive = bollinger(closes, bbP, 2);

  const series = bars.map((b, i) => ({
    date: b.date,
    close: b.close,
    volume: b.volume,
    return: ret[i],
    sma10: sma10[i],
    sma20: sma20[i],
    sma50: sma50[i],
    ema12: ema12[i],
    ema26: ema26[i],
    rsi14: rsi14[i],
    roc10: roc10[i],
    volatility10: vol10[i],
    bbUpper: bb.upper[i],
    bbMiddle: bb.middle[i],
    bbLower: bb.lower[i],
    atr14: atr14[i],
    // Adaptive fields consumed by the model (windows scale with history depth).
    smaFast: smaFast[i],
    smaSlow: smaSlow[i],
    rsiAdaptive: rsiAdaptive[i],
    rocAdaptive: rocAdaptive[i],
    bbAdaptiveUpper: bbAdaptive.upper[i],
    bbAdaptiveLower: bbAdaptive.lower[i],
  }));

  return {
    series,
    latest: last(series),
    periods: { fastTrend, slowTrend, rsiP, rocP, bbP },
    // Surface MACD-style line/signal too (EMA12 - EMA26), a common momentum read.
    macd: closes.map((_, i) =>
      ema12[i] != null && ema26[i] != null ? ema12[i] - ema26[i] : null
    ),
  };
}
