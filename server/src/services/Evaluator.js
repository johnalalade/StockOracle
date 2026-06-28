import { computeIndicators } from './TechnicalIndicatorEngine.js';
import { predictTechnical } from './TechnicalModel.js';

/**
 * Evaluator
 *
 * Walk-forward backtest of the technical directional signal over the
 * available history, producing the methodology's evaluation metrics
 * (§3.9): Accuracy, Precision, Recall, F1 for direction (Buy=Up/Sell=Down),
 * plus RMSE/MSE/MAE of a next-close baseline for the regression view.
 *
 * At each step t it computes indicators from bars[0..t] only (no lookahead),
 * predicts the direction of day t+1, and compares to the realised move.
 */
export function backtest(bars, { minLookback = 5 } = {}) {
  if (bars.length < minLookback + 2) {
    return {
      evaluable: false,
      reason: `Need at least ${minLookback + 2} daily bars; have ${bars.length}. History deepens automatically on each fetch.`,
      samples: 0,
    };
  }

  let tp = 0; // predicted UP, actual UP
  let fp = 0; // predicted UP, actual DOWN
  let tn = 0; // predicted DOWN, actual DOWN
  let fn = 0; // predicted DOWN, actual UP
  let correct = 0;
  let samples = 0;
  let sqErr = 0;
  let absErr = 0;

  for (let t = minLookback; t < bars.length - 1; t += 1) {
    const window = bars.slice(0, t + 1);
    const indicators = computeIndicators(window);
    const pred = predictTechnical(indicators);
    if (pred.direction === 'NEUTRAL') continue; // only score decisive calls

    const actualUp = bars[t + 1].close > bars[t].close;
    const predUp = pred.direction === 'UP';
    samples += 1;
    if (predUp === actualUp) correct += 1;
    if (predUp && actualUp) tp += 1;
    else if (predUp && !actualUp) fp += 1;
    else if (!predUp && !actualUp) tn += 1;
    else fn += 1;

    // Regression baseline: predict next close = today's close (persistence).
    const err = bars[t + 1].close - bars[t].close;
    sqErr += err * err;
    absErr += Math.abs(err);
  }

  if (samples === 0) {
    return { evaluable: false, reason: 'No decisive directional predictions in window.', samples: 0 };
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const mse = sqErr / samples;

  const r3 = (x) => Number(x.toFixed(3));
  return {
    evaluable: true,
    samples,
    classification: {
      accuracy: r3(correct / samples),
      precision: r3(precision),
      recall: r3(recall),
      f1: r3(f1),
      confusion: { tp, fp, tn, fn },
    },
    regressionBaseline: {
      mse: r3(mse),
      rmse: r3(Math.sqrt(mse)),
      mae: r3(absErr / samples),
      note: 'RMSE/MAE of a persistence (last-close) baseline, for reference.',
    },
  };
}
