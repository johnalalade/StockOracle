import { config, hasEODHD } from '../config.js';
import { fetchText, TTLCache } from '../utils/http.js';
import { logger } from '../utils/logger.js';

/**
 * EODHD provider — the primary, datacenter-friendly live market-data source.
 *
 * Unlike AFX (which blocks serverless/datacenter IPs and only exposes ~10
 * close-only days), EODHD works from any host and returns deep daily OHLCV, so
 * it powers genuinely live predictions on Vercel. Requires EODHD_API_KEY.
 *
 * Docs: https://eodhd.com/financial-apis/
 *   EOD:          /api/eod/{TICKER}.{EXCHANGE}
 *   Symbol list:  /api/exchange-symbol-list/{EXCHANGE}
 */

const API = 'https://eodhd.com/api';
const listCache = new TTLCache(config.marketCacheMs);
const tickerCache = new TTLCache(config.marketCacheMs);

export { hasEODHD };

const num = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

async function getJson(url) {
  const text = await fetchText(url, { timeoutMs: 12000 });
  const data = JSON.parse(text);
  // EODHD returns a plain string / object on auth or symbol errors.
  if (!Array.isArray(data)) {
    const msg = typeof data === 'string' ? data : data?.message || JSON.stringify(data).slice(0, 120);
    throw new Error(`EODHD non-array response: ${msg}`);
  }
  return data;
}

/**
 * Full list of equities on the configured exchange.
 * @returns {Promise<Array<{ticker,name,price,change,volume}>>}
 */
export async function fetchEquityListEODHD() {
  if (!hasEODHD) throw new Error('EODHD not configured');
  return listCache.wrap('list', async () => {
    const url = `${API}/exchange-symbol-list/${config.eodhdExchange}?api_token=${config.eodhdApiKey}&fmt=json`;
    const rows = await getJson(url);
    const list = rows
      // Keep tradable equities; EODHD tags Type e.g. "Common Stock".
      .filter((r) => r.Code && (!r.Type || /stock|share|equit/i.test(r.Type)))
      .map((r) => ({
        ticker: String(r.Code).toUpperCase(),
        name: r.Name || String(r.Code),
        price: null, // symbol-list has no quote; prices load per prediction
        change: null,
        volume: null,
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
    if (!list.length) throw new Error('EODHD returned no symbols for exchange');
    logger.info(`Fetched ${list.length} equities from EODHD (${config.eodhdExchange})`);
    return list;
  });
}

/**
 * Daily price history + latest quote for one ticker.
 * @returns {Promise<{ticker,name,sector,price,bars:Array<{date,close,volume}>,source}>}
 */
export async function fetchTickerEODHD(ticker) {
  if (!hasEODHD) throw new Error('EODHD not configured');
  const upper = ticker.toUpperCase();
  return tickerCache.wrap(upper, async () => {
    const symbol = `${upper}.${config.eodhdExchange}`;
    const from = isoDaysAgo(config.eodhdHistoryDays);
    const url =
      `${API}/eod/${encodeURIComponent(symbol)}?api_token=${config.eodhdApiKey}` +
      `&fmt=json&period=d&order=a&from=${from}`;
    const rows = await getJson(url);
    const bars = rows
      .map((r) => ({ date: r.date, close: num(r.close ?? r.adjusted_close), volume: num(r.volume) }))
      .filter((b) => b.date && b.close != null);
    if (!bars.length) throw new Error(`EODHD has no price data for ${symbol}`);
    const last = bars[bars.length - 1];
    return {
      ticker: upper,
      name: null, // filled from the equity list by the caller when available
      sector: null,
      price: last.close,
      bars,
      source: 'eodhd',
    };
  });
}
