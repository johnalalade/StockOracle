import * as cheerio from 'cheerio';
import { fetchText, TTLCache } from '../utils/http.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const BASE = 'https://afx.kwayisi.org/ngx';
const listCache = new TTLCache(config.marketCacheMs);
const tickerCache = new TTLCache(config.marketCacheMs);

const num = (s) => {
  if (s == null) return null;
  const n = Number(String(s).replace(/[, ]/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * Scrape the full NGX equities list.
 * Row layout on AFX: Ticker | Name | Volume | Price | Change
 * @returns {Promise<Array<{ticker,name,volume,price,change}>>}
 */
export async function fetchEquityList() {
  return listCache.wrap('list', async () => {
    const equities = [];
    const parsePage = (html) => {
      const $ = cheerio.load(html);
      const rows = [];
      $('table tbody tr').each((_, tr) => {
        const cells = $(tr).find('td');
        if (cells.length < 5) return;
        const link = $(cells[0]).find('a').attr('href') || '';
        // Only data rows link to /ngx/<slug>.html
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

    // AFX paginates (~6 pages cover the market). Fetch them in parallel to
    // stay well under serverless timeouts; skip any page that fails.
    const pages = [1, 2, 3, 4, 5, 6];
    const results = await Promise.allSettled(
      pages.map((page) => fetchText(page === 1 ? `${BASE}/` : `${BASE}/?page=${page}`))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') equities.push(...parsePage(r.value));
      else logger.warn(`equity list page ${pages[i]} failed: ${r.reason?.message}`);
    });

    // De-duplicate by ticker (pages can overlap).
    const byTicker = new Map();
    for (const e of equities) if (!byTicker.has(e.ticker)) byTicker.set(e.ticker, e);
    const list = [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
    logger.info(`Fetched ${list.length} NGX equities from AFX`);
    return list;
  });
}

/**
 * Scrape a single ticker page: quote + recent daily history.
 * History table layout: Date | Volume | Close | Change | Change%
 * @returns {Promise<{ticker,name,sector,price,change,bars:Array<{date,close,volume}>}>}
 */
export async function fetchTicker(ticker) {
  const slug = ticker.toLowerCase();
  return tickerCache.wrap(slug, async () => {
    const html = await fetchText(`${BASE}/${slug}.html`);
    const $ = cheerio.load(html);

    const heading = $('h1').first().text().trim(); // "GTCO - Guaranty Trust Holding"
    const name = heading.includes('-') ? heading.split('-').slice(1).join('-').trim() : heading;
    // AFX shows a short sector label (e.g. "Commercial Banking") as a brief <p>;
    // longer first paragraphs are the company profile, so ignore those.
    const firstP = $('main article p').first().text().trim();
    const sector = firstP && firstP.length <= 60 ? firstP : null;

    const bars = [];
    $('table').each((_, table) => {
      const headers = $(table)
        .find('thead th')
        .map((_, th) => $(th).text().trim().toLowerCase())
        .get();
      // The daily history table has a Date column and a Close column.
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
    const last = bars[bars.length - 1];
    return {
      ticker: ticker.toUpperCase(),
      name,
      sector,
      price: last ? last.close : null,
      bars,
    };
  });
}
