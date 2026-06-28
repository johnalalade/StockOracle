import { fetchEquityList, fetchTicker } from '../providers/ngxMarketProvider.js';
import { fetchNews } from '../providers/newsProvider.js';
import { historyStore } from '../store/historyStore.js';
import { cleanBars } from './Preprocessor.js';

/**
 * DataCollector
 *
 * Single entry point for acquiring market + fundamental data. Wraps the
 * scraper providers and merges every fetched price series into the durable
 * history store so the time-series deepens across runs.
 */

let listNameMap = null; // ticker -> company name, populated from the equity list

export async function getEquities() {
  const list = await fetchEquityList();
  listNameMap = new Map(list.map((e) => [e.ticker, e.name]));
  return list;
}

export async function resolveName(ticker) {
  if (listNameMap?.has(ticker.toUpperCase())) return listNameMap.get(ticker.toUpperCase());
  try {
    const t = await fetchTicker(ticker);
    return t.name || ticker;
  } catch {
    return ticker;
  }
}

/**
 * Fetch a ticker's quote + history, merge into the store, and return the
 * full (deepest available) cleaned series.
 */
export async function getPriceHistory(ticker) {
  const t = await fetchTicker(ticker);
  if (t.bars?.length) historyStore.merge(ticker, t.bars);
  // The persisted series is the union of every scrape we've ever done.
  const merged = cleanBars(historyStore.get(ticker));
  const bars = merged.length >= (t.bars?.length || 0) ? merged : cleanBars(t.bars || []);
  return {
    ticker: t.ticker,
    name: t.name,
    sector: t.sector,
    price: t.price,
    bars,
  };
}

export async function getCompanyNews(ticker, company, opts = {}) {
  const name = company || (await resolveName(ticker));
  return fetchNews(name, ticker, opts);
}
