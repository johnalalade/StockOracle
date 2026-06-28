import * as cheerio from 'cheerio';
import { fetchText, TTLCache } from '../utils/http.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const newsCache = new TTLCache(config.newsCacheMs);

/**
 * Fetch recent news headlines for a company via Google News RSS.
 * Queryable per company and reliable/free, returning dated, sourced items.
 *
 * @param {string} company  Human-readable company name (better recall than ticker)
 * @param {string} ticker
 * @returns {Promise<Array<{title,source,date,link}>>}
 */
export async function fetchNews(company, ticker, { limit = 25 } = {}) {
  const key = `${ticker}:${limit}`;
  return newsCache.wrap(key, async () => {
    // Bias the query toward Nigerian market/equity coverage.
    const q = encodeURIComponent(`${company} ${ticker} Nigeria stock NGX`);
    const url = `https://news.google.com/rss/search?q=${q}&hl=en-NG&gl=NG&ceid=NG:en`;
    let xml;
    try {
      xml = await fetchText(url);
    } catch (err) {
      logger.warn(`news fetch failed for ${ticker}: ${err.message}`);
      return [];
    }
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];
    $('item').each((_, el) => {
      const item = $(el);
      const rawTitle = item.find('title').text().trim();
      // Google News titles are "Headline - Source"; split the source out.
      const dashIdx = rawTitle.lastIndexOf(' - ');
      const title = dashIdx > 0 ? rawTitle.slice(0, dashIdx) : rawTitle;
      const source =
        item.find('source').text().trim() ||
        (dashIdx > 0 ? rawTitle.slice(dashIdx + 3) : '');
      const dateStr = item.find('pubDate').text().trim();
      items.push({
        title,
        source,
        date: dateStr ? new Date(dateStr).toISOString() : null,
        link: item.find('link').text().trim(),
      });
    });
    // Most recent first.
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return items.slice(0, limit);
  });
}
