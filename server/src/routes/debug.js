import { Router } from 'express';
import { config, hasEODHD } from '../config.js';

const router = Router();

/**
 * GET /api/debug/eodhd — verify the EODHD key + exchange code by fetching a
 * known ticker. Reveals nothing secret; returns counts and a short error, if any.
 */
router.get('/eodhd', async (req, res) => {
  if (!hasEODHD) return res.json({ configured: false, hint: 'Set EODHD_API_KEY to enable.' });
  const ticker = (req.query.ticker || 'GTCO').toString().toUpperCase();
  const symbol = `${ticker}.${config.eodhdExchange}`;
  const url =
    `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?api_token=${config.eodhdApiKey}` +
    `&fmt=json&period=d&order=a&from=${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}`;
  try {
    const r = await fetch(url);
    const body = await r.text();
    let bars = null;
    try {
      const j = JSON.parse(body);
      bars = Array.isArray(j) ? j.length : null;
    } catch {
      /* non-JSON */
    }
    res.json({
      configured: true,
      exchange: config.eodhdExchange,
      symbol,
      status: r.status,
      bars,
      snippet: body.slice(0, 200),
    });
  } catch (err) {
    res.json({ configured: true, symbol, error: err.message });
  }
});

/**
 * Diagnostic endpoint: shows exactly what the server (e.g. a Vercel function)
 * receives when it reaches out to the live data sources. Helps distinguish an
 * IP block, a timeout, or an HTML-shape change from the app's own logic.
 * GET /api/debug/sources
 */
router.get('/sources', async (_req, res) => {
  const probe = async (label, url) => {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': config.userAgent },
      });
      const body = await r.text();
      return {
        label,
        url,
        ok: r.ok,
        status: r.status,
        ms: Date.now() - started,
        bytes: body.length,
        // First bytes so we can see a challenge page / block message if any.
        snippet: body.replace(/\s+/g, ' ').slice(0, 240),
      };
    } catch (err) {
      return { label, url, error: err.name + ': ' + err.message, ms: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  };

  const [afx, afxTicker, news] = await Promise.all([
    probe('afx-list', 'https://afx.kwayisi.org/ngx/'),
    probe('afx-ticker', 'https://afx.kwayisi.org/ngx/gtco.html'),
    probe('google-news', 'https://news.google.com/rss/search?q=GTCO%20Nigeria%20stock&hl=en-NG&gl=NG&ceid=NG:en'),
  ]);

  res.json({ region: process.env.VERCEL_REGION || 'local', node: process.version, afx, afxTicker, news });
});

export default router;
