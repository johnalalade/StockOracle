import { config, hasLLM } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * LLMFundamentalAnalyzer
 *
 * Converts unstructured news/financial text into the structured fundamental
 * vector from the methodology (§3.6): sentiment (-1..+1), significance (0..1),
 * and category flags (Macro / Earnings / Regulatory), plus risk flags.
 *
 * Uses Claude at temperature 0 for deterministic JSON extraction. When no
 * ANTHROPIC_API_KEY is configured it transparently falls back to a
 * deterministic finance-lexicon heuristic, so the system always returns a
 * usable fundamental signal.
 */

const SYSTEM = `You are a financial news analyst specialising in the Nigerian Exchange (NGX).
You are sensitive to local market-moving narratives: Naira/FX policy, CBN interest-rate
decisions, fuel subsidy, oil prices, inflation, banking recapitalisation, dividend and
earnings releases, and political/regulatory events.
For each headline, judge its impact on the GIVEN company's share price.
Return ONLY valid JSON. No prose, no markdown.`;

function buildPrompt(company, ticker, headlines) {
  const list = headlines.map((h, i) => `${i}. "${h.title}" (${h.source || 'news'})`).join('\n');
  return `Company: ${company} (NGX:${ticker})

Headlines:
${list}

For EACH headline return an object with:
- "i": the headline index (integer)
- "sentiment": number in [-1, 1]  (-1 very bearish, 0 neutral, +1 very bullish for THIS stock)
- "significance": number in [0, 1]  (likely magnitude of price impact)
- "macro": boolean (macroeconomic / FX / rates / inflation / oil)
- "earnings": boolean (earnings, profit, revenue, dividend, results)
- "regulatory": boolean (regulator, policy, court, sanction, listing rule)
- "rationale": short string (max 12 words)

Then return an "aggregate" object with:
- "sentiment": overall weighted sentiment in [-1, 1]
- "significance": overall significance in [0, 1]
- "riskFlags": array of short strings (e.g. "profit drop", "FX pressure", "regulatory risk", "high debt")
- "summary": one-sentence outlook (max 30 words)

Respond as: {"items":[...],"aggregate":{...}}`;
}

function safeJsonParse(text) {
  // Strip code fences and grab the outermost JSON object.
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in LLM response');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Call the Anthropic Messages API directly via fetch (no SDK; Node 18+ safe). */
async function callAnthropic(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

async function analyzeWithLLM(company, ticker, headlines) {
  const msg = await callAnthropic({
    model: config.llmModel,
    max_tokens: 2000,
    temperature: 0, // deterministic extraction (methodology §3.6.4)
    system: SYSTEM,
    messages: [{ role: 'user', content: buildPrompt(company, ticker, headlines) }],
  });
  const text = (msg.content || []).map((c) => (c.type === 'text' ? c.text : '')).join('');
  const parsed = safeJsonParse(text);

  const items = (parsed.items || []).map((it) => ({
    title: headlines[it.i]?.title ?? '',
    source: headlines[it.i]?.source ?? '',
    date: headlines[it.i]?.date ?? null,
    sentiment: clampNum(it.sentiment, -1, 1),
    significance: clampNum(it.significance, 0, 1),
    categories: {
      macro: Boolean(it.macro),
      earnings: Boolean(it.earnings),
      regulatory: Boolean(it.regulatory),
    },
    rationale: String(it.rationale || ''),
  }));

  const agg = parsed.aggregate || {};
  return {
    engine: 'llm',
    model: config.llmModel,
    sentiment: clampNum(agg.sentiment, -1, 1),
    significance: clampNum(agg.significance, 0, 1),
    riskFlags: Array.isArray(agg.riskFlags) ? agg.riskFlags.slice(0, 8) : [],
    summary: String(agg.summary || ''),
    items,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback (no API key): finance-lexicon scoring.
// ---------------------------------------------------------------------------

const LEX = {
  bull: {
    surge: 0.7, soar: 0.8, rally: 0.6, gain: 0.5, gains: 0.5, rise: 0.4, rises: 0.4, jump: 0.6,
    jumps: 0.6, profit: 0.5, 'profit rise': 0.7, dividend: 0.5, growth: 0.5, record: 0.6,
    beat: 0.6, beats: 0.6, upgrade: 0.6, bullish: 0.7, expansion: 0.4, acquire: 0.3,
    'all-time high': 0.8, outperform: 0.6, approval: 0.4, listing: 0.3, recapitalisation: 0.2,
  },
  bear: {
    plunge: -0.8, plunges: -0.8, crash: -0.9, slump: -0.7, fall: -0.5, falls: -0.5, drop: -0.5,
    drops: -0.5, loss: -0.6, losses: -0.6, decline: -0.5, declines: -0.5, downgrade: -0.6,
    bearish: -0.7, fraud: -0.9, probe: -0.6, sanction: -0.6, fine: -0.5, lawsuit: -0.5,
    default: -0.7, debt: -0.4, devaluation: -0.6, inflation: -0.4, weak: -0.5, cut: -0.4,
    suspend: -0.6, suspended: -0.6, 'profit drop': -0.7, recession: -0.6, selloff: -0.7,
  },
  macro: ['naira', 'fx', 'forex', 'exchange rate', 'cbn', 'interest rate', 'inflation', 'oil',
    'subsidy', 'devaluation', 'monetary', 'gdp', 'recession'],
  earnings: ['profit', 'earnings', 'revenue', 'dividend', 'results', 'eps', 'q1', 'q2', 'q3',
    'q4', 'half-year', 'full-year', 'turnover'],
  regulatory: ['sec', 'regulator', 'regulatory', 'policy', 'court', 'sanction', 'fine',
    'probe', 'listing', 'cbn', 'ruling', 'lawsuit', 'recapitalisation'],
};

function scoreHeadlineHeuristic(title) {
  const t = ` ${title.toLowerCase()} `;
  let sentiment = 0;
  let hits = 0;
  for (const [word, w] of Object.entries({ ...LEX.bull, ...LEX.bear })) {
    if (t.includes(` ${word} `) || t.includes(`${word} `) || t.includes(` ${word}`)) {
      sentiment += w;
      hits += 1;
    }
  }
  if (hits > 0) sentiment = clampNum(sentiment / Math.sqrt(hits), -1, 1);
  const has = (arr) => arr.some((k) => t.includes(k));
  const categories = {
    macro: has(LEX.macro),
    earnings: has(LEX.earnings),
    regulatory: has(LEX.regulatory),
  };
  // Significance: category presence + sentiment magnitude.
  const significance = clampNum(
    0.2 + Math.abs(sentiment) * 0.5 + (categories.earnings ? 0.2 : 0) + (categories.macro ? 0.15 : 0),
    0,
    1
  );
  return { sentiment, significance, categories, hits };
}

function analyzeHeuristic(company, ticker, headlines) {
  const items = headlines.map((h) => {
    const s = scoreHeadlineHeuristic(h.title);
    return {
      title: h.title,
      source: h.source,
      date: h.date,
      sentiment: Number(s.sentiment.toFixed(3)),
      significance: Number(s.significance.toFixed(3)),
      categories: s.categories,
      rationale: s.hits ? 'lexicon match' : 'neutral / no signal words',
    };
  });

  // Recency- and significance-weighted aggregate sentiment.
  let wsum = 0;
  let sentAcc = 0;
  let sigAcc = 0;
  items.forEach((it, idx) => {
    const recency = 1 / (1 + idx * 0.15); // newer headlines weigh more
    const w = recency * (0.3 + it.significance);
    sentAcc += it.sentiment * w;
    sigAcc += it.significance * w;
    wsum += w;
  });
  const sentiment = wsum ? clampNum(sentAcc / wsum, -1, 1) : 0;
  const significance = wsum ? clampNum(sigAcc / wsum, 0, 1) : 0.2;

  const riskFlags = [];
  if (items.some((i) => i.categories.macro && i.sentiment < 0)) riskFlags.push('macro / FX pressure');
  if (items.some((i) => i.categories.regulatory && i.sentiment < 0)) riskFlags.push('regulatory risk');
  if (items.some((i) => i.categories.earnings && i.sentiment < 0)) riskFlags.push('earnings weakness');
  if (sentiment < -0.3) riskFlags.push('bearish news flow');

  const tone = sentiment > 0.15 ? 'positive' : sentiment < -0.15 ? 'negative' : 'mixed/neutral';
  return {
    engine: 'heuristic',
    model: 'finance-lexicon',
    sentiment: Number(sentiment.toFixed(3)),
    significance: Number(significance.toFixed(3)),
    riskFlags,
    summary: `Recent ${company} news flow is ${tone} based on lexicon analysis of ${items.length} headlines.`,
    items,
  };
}

function clampNum(x, lo, hi) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Analyze headlines into a structured fundamental signal.
 * Falls back to the heuristic on missing key or LLM error.
 */
export async function analyzeFundamentals(company, ticker, headlines) {
  if (!headlines.length) {
    return {
      engine: hasLLM ? 'llm' : 'heuristic',
      model: hasLLM ? config.llmModel : 'finance-lexicon',
      sentiment: 0,
      significance: 0,
      riskFlags: [],
      summary: 'No recent news found for this company.',
      items: [],
    };
  }
  if (hasLLM) {
    try {
      return await analyzeWithLLM(company, ticker, headlines);
    } catch (err) {
      logger.warn(`LLM analysis failed (${err.message}); using heuristic fallback`);
    }
  }
  return analyzeHeuristic(company, ticker, headlines);
}
