/**
 * FusionModel
 *
 * Decision-level fusion (methodology §3.7.2): combine the technical
 * probability (P_tech, prob of UP) and the fundamental signal into one
 * final probability and a BUY / SELL / HOLD recommendation with confidence.
 *
 *   P_final = α · P_tech + (1 − α) · P_fund
 *
 * α is not fixed: it shifts weight toward fundamentals when news is highly
 * significant (event-driven regimes), and toward technicals when news is
 * quiet — reflecting that on the NGX, policy/earnings shocks dominate price
 * action when they occur, while technicals carry the quiet periods.
 */

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/**
 * @param {object} technical  predictTechnical() output
 * @param {object} fundamental analyzeFundamentals() output
 * @returns {object} fused recommendation
 */
export function fuse(technical, fundamental) {
  const pTech = technical.probUp ?? 0.5;

  // Convert fundamental sentiment (-1..+1) into a prob-of-UP (0..1).
  const pFund = clamp(0.5 + fundamental.sentiment * 0.5, 0.02, 0.98);

  // Base weight 0.6 technical; news significance pulls weight to fundamentals.
  const sig = fundamental.significance ?? 0;
  const newsCount = fundamental.items?.length ?? 0;
  const fundReliability = clamp(newsCount / 10, 0, 1); // little/no news ⇒ trust technicals
  let alpha = 0.6 - 0.35 * sig * fundReliability;
  alpha = clamp(alpha, 0.3, 0.85);

  const pFinal = clamp(alpha * pTech + (1 - alpha) * pFund, 0.02, 0.98);

  // Map probability to a recommendation with a neutral HOLD band.
  let recommendation;
  if (pFinal >= 0.58) recommendation = 'BUY';
  else if (pFinal <= 0.42) recommendation = 'SELL';
  else recommendation = 'HOLD';

  // Confidence blends model confidences with distance from the 0.5 coin-flip,
  // and is dampened when technical and fundamental signals disagree.
  const conviction = Math.abs(pFinal - 0.5) * 2; // 0..1
  const agreement = 1 - Math.abs(pTech - pFund); // 1 = aligned, 0 = opposed
  const baseConf = alpha * (technical.confidence ?? 0.3) + (1 - alpha) * (0.3 + 0.7 * sig);
  const confidence = clamp(0.5 * baseConf + 0.35 * conviction + 0.15 * agreement, 0.1, 0.97);

  return {
    recommendation,
    probUp: Number(pFinal.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    alpha: Number(alpha.toFixed(3)),
    components: {
      technical: { probUp: Number(pTech.toFixed(4)), confidence: technical.confidence },
      fundamental: { probUp: Number(pFund.toFixed(4)), sentiment: fundamental.sentiment, significance: sig },
    },
    agreement: Number(agreement.toFixed(3)),
  };
}

/**
 * Build a plain-language explanation of the recommendation for the UI.
 */
export function explain(ticker, fused, technical, fundamental, quote) {
  const dir = fused.recommendation;
  const pct = (fused.probUp * 100).toFixed(0);
  const conf = (fused.confidence * 100).toFixed(0);
  const techDir = technical.direction;
  const tone =
    fundamental.sentiment > 0.15 ? 'positive' : fundamental.sentiment < -0.15 ? 'negative' : 'neutral';

  const parts = [];
  parts.push(
    `${dir} signal for ${ticker} with ${conf}% confidence (modelled ${pct}% probability of an upward move).`
  );
  parts.push(
    `Technical read is ${techDir.toLowerCase()} (P_up ${(technical.probUp * 100).toFixed(0)}%), driven by ${
      technical.signals
        .filter((s) => Math.abs(s.value) > 0.2)
        .slice(0, 3)
        .map((s) => s.name)
        .join(', ') || 'limited indicator data'
    }.`
  );
  parts.push(
    `Fundamental/news flow is ${tone} (sentiment ${fundamental.sentiment.toFixed(2)}, significance ${fundamental.significance.toFixed(
      2
    )})${fundamental.riskFlags.length ? `; risk flags: ${fundamental.riskFlags.join(', ')}` : ''}.`
  );
  parts.push(
    `Fusion weighted technicals at ${(fused.alpha * 100).toFixed(0)}% and fundamentals at ${(
      (1 - fused.alpha) *
      100
    ).toFixed(0)}%; the two pipelines ${fused.agreement > 0.6 ? 'broadly agree' : 'partially diverge'}.`
  );
  return parts.join(' ');
}
