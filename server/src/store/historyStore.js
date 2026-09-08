import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Vercel (and other serverless hosts) the app filesystem is read-only;
// only /tmp is writable, so persist there. Locally, use the repo data dir.
const DATA_DIR = process.env.VERCEL
  ? '/tmp/stockoracle-data'
  : path.resolve(__dirname, '../../data');
const FILE = path.join(DATA_DIR, 'history.json');

/**
 * Persists daily price history per ticker to a JSON file.
 *
 * AFX exposes only ~10 recent days per stock, so we merge every fetch
 * into a durable store. Over time the series deepens, which directly
 * improves the technical indicators and model confidence.
 *
 * Shape: { TICKER: { "YYYY-MM-DD": { date, close, volume } } }
 */
class HistoryStore {
  constructor() {
    this.data = {};
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(FILE)) {
        this.data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        logger.info(`History store loaded (${Object.keys(this.data).length} tickers)`);
      }
    } catch (err) {
      logger.error('Failed to load history store, starting fresh:', err.message);
      this.data = {};
    }
  }

  _persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(this.data));
    } catch (err) {
      logger.error('Failed to persist history store:', err.message);
    }
  }

  /**
   * Merge an array of { date, close, volume } bars into a ticker's series.
   * Existing dates are updated (latest scrape wins) and new dates appended.
   */
  merge(ticker, bars) {
    const key = ticker.toUpperCase();
    const series = this.data[key] || (this.data[key] = {});
    let added = 0;
    for (const bar of bars) {
      if (!bar?.date || bar.close == null) continue;
      if (!series[bar.date]) added += 1;
      series[bar.date] = {
        date: bar.date,
        close: Number(bar.close),
        volume: bar.volume == null ? null : Number(bar.volume),
      };
    }
    if (added > 0 || bars.length > 0) this._persist();
    return added;
  }

  /** Return a ticker's bars sorted ascending by date. */
  get(ticker) {
    const series = this.data[ticker.toUpperCase()] || {};
    return Object.values(series).sort((a, b) => a.date.localeCompare(b.date));
  }

  tickers() {
    return Object.keys(this.data);
  }
}

export const historyStore = new HistoryStore();
