import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

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
