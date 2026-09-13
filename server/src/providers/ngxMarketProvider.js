import * as cheerio from 'cheerio';
import { fetchText, TTLCache } from '../utils/http.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * AFX (kwayisi) provider — free NGX scraper. Used as a secondary source behind
 * EODHD (AFX blocks datacenter IPs and only exposes ~10 close-only days, so it
 * mainly serves local/residential runs and the seed-refresh script). Pure: it
 * returns [] / throws on failure; the marketData orchestrator owns fallbacks.
 */

const BASE = 'https://afx.kwayisi.org/ngx';
const listCache = new TTLCache(config.marketCacheMs);
const tickerCache = new TTLCache(config.marketCacheMs);

const num = (s) => {
  if (s == null) return null;
  const n = Number(String(s).replace(/[, ]/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Scrape the full NGX equities list. Row layout: Ticker | Name | Volume | Price | Change
 * @returns {Promise<Array<{ticker,name,volume,price,change}>>} empty on failure
 */
export async function fetchEquityListAFX() {
  return listCache.wrap('list', async () => {
    const equities = [];
    const parsePage = (html) => {
      const $ = cheerio.load(html);
      const rows = [];
      $('table tbody tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 5) return;
        const link = $(cells[0]).find('a').attr('href') || '';
        if (!/\/ngx\/[a-z0-9.]+\.html/i.test(link)) return;
        const ticker = $(cells[0]).text().trim().toUpperCase();
        const name = $(cells[1]).text().trim();
        if (!ticker || !name) return;
        rows.push({
          ticker,
          name,
          volume: num($(cells[2]).text()),
          price: num($(cells[3]).text()),
          change: num($(cells[4]).text()),
        });
      });
      return rows;
    };

    // AFX paginates (~6 pages cover the market). Fetch in parallel; skip failures.
    const pages = [1, 2, 3, 4, 5, 6];
    const results = await Promise.allSettled(
      pages.map((page) => fetchText(page === 1 ? `${BASE}/` : `${BASE}/?page=${page}`))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') equities.push(...parsePage(r.value));
      else logger.warn(`AFX equity list page ${pages[i]} failed: ${r.reason?.message}`);
    });

    const byTicker = new Map();
    for (const e of equities) if (!byTicker.has(e.ticker)) byTicker.set(e.ticker, e);
    const list = [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
    if (list.length) logger.info(`Fetched ${list.length} NGX equities from AFX`);
    return list;
  });
}

/**
 * Scrape one ticker page: quote + recent daily history.
 * History table: Date | Volume | Close | Change | Change%
 * @returns {Promise<{ticker,name,sector,price,bars,source}>} throws on failure/empty
 */
export async function fetchTickerAFX(ticker) {
  const slug = ticker.toLowerCase();
  const upper = ticker.toUpperCase();
  return tickerCache.wrap(slug, async () => {
    const html = await fetchText(`${BASE}/${slug}.html`);
    const $ = cheerio.load(html);

    const heading = $('h1').first().text().trim(); // "GTCO - Guaranty Trust Holding"
    const name = heading.includes('-') ? heading.split('-').slice(1).join('-').trim() : heading;
    const firstP = $('main article p').first().text().trim();
    const sector = firstP && firstP.length <= 60 ? firstP : null;

    const bars = [];
    $('table').each((_, table) => {
      const headers = $(table)
        .find('thead th')
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      if (!headers.some((h) => h.includes('date')) || !headers.some((h) => h.includes('close')))
        return;
      const dateIdx = headers.findIndex((h) => h.includes('date'));
      const volIdx = headers.findIndex((h) => h.includes('volume') || h.includes('vol'));
      const closeIdx = headers.findIndex((h) => h.includes('close'));
      $(table)
        .find('tbody tr')
        .each((_, tr) => {
          const cells = $(tr).find('td');
          const date = $(cells[dateIdx]).text().trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          bars.push({
            date,
            close: num($(cells[closeIdx]).text()),
            volume: volIdx >= 0 ? num($(cells[volIdx]).text()) : null,
          });
        });
    });

    bars.sort((a, b) => a.date.localeCompare(b.date));
    if (bars.length === 0) throw new Error(`AFX returned no price rows for ${upper}`);

    const last = bars[bars.length - 1];
    return { ticker: upper, name, sector, price: last ? last.close : null, bars, source: 'live' };
  });
}
