import { hasEODHD, fetchEquityListEODHD, fetchTickerEODHD } from '../providers/eodhdProvider.js';
import { fetchEquityListAFX, fetchTickerAFX } from '../providers/ngxMarketProvider.js';
import { seedEquities, seedTicker } from '../seed/index.js';
import { logger } from '../utils/logger.js';

/**
 * marketData — the market-data orchestrator.
 *
 * Provider chain (first success wins):
 *   1. EODHD        — primary live source; works from datacenters/Vercel (needs key)
 *   2. AFX scrape   — free fallback; works from residential/local IPs
 *   3. Seed snapshot — bundled offline fallback so the app always responds
 *
 * `getMarketSource()` reports which source served the most recent equity list,
 * and every ticker result carries its own `source` for the UI to label.
 */

let marketSource = hasEODHD ? 'eodhd' : 'live';
export const getMarketSource = () => marketSource;

export async function fetchEquityList() {
  // 1) EODHD
  if (hasEODHD) {
    try {
      const list = await fetchEquityListEODHD();
      if (list.length) {
        marketSource = 'eodhd';
        return list;
      }
    } catch (err) {
      logger.warn(`EODHD equity list failed: ${err.message}`);
    }
  }
  // 2) AFX
  try {
    const list = await fetchEquityListAFX();
    if (list.length) {
      marketSource = 'live';
      return list;
    }
  } catch (err) {
    logger.warn(`AFX equity list failed: ${err.message}`);
  }
  // 3) Seed snapshot
  marketSource = 'cached';
  logger.warn(`Serving ${seedEquities.length} seeded equities (no live source available)`);
  return seedEquities;
}

export async function fetchTicker(ticker) {
  const upper = ticker.toUpperCase();

  // 1) EODHD
  if (hasEODHD) {
    try {
      const t = await fetchTickerEODHD(upper);
      if (t?.bars?.length) return t;
    } catch (err) {
      logger.warn(`EODHD ticker ${upper} failed: ${err.message}`);
    }
  }
  // 2) AFX
  try {
    const t = await fetchTickerAFX(upper);
    if (t?.bars?.length) return t;
  } catch (err) {
    logger.warn(`AFX ticker ${upper} failed: ${err.message}`);
  }
  // 3) Seed snapshot
  const seed = seedTicker(upper);
  if (seed?.bars?.length) {
    const last = seed.bars[seed.bars.length - 1];
    return {
      ticker: upper,
      name: seed.name || upper,
      sector: seed.sector || null,
      price: last ? last.close : null,
      bars: seed.bars,
      source: 'cached',
    };
  }

  const err = new Error(
    `Price data for ${upper} is currently unavailable (no live source reachable, ` +
      `and this ticker isn't in the cached snapshot).`
  );
  err.status = 503;
  throw err;
}
