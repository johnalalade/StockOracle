import { Router } from 'express';
import { getEquities, getPriceHistory, getCompanyNews, resolveName } from '../services/DataCollector.js';
import { computeIndicators } from '../services/TechnicalIndicatorEngine.js';

const router = Router();

/** GET /api/stocks — full NGX equities list (ticker, name, price, change, volume). */
router.get('/', async (req, res, next) => {
  try {
    const list = await getEquities();
    const q = (req.query.q || '').toString().trim().toLowerCase();
    const filtered = q
      ? list.filter((e) => e.ticker.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
      : list;
    res.json({ count: filtered.length, equities: filtered });
  } catch (err) {
    next(err);
  }
});

/** GET /api/stocks/:ticker — quote + price history + computed indicators. */
router.get('/:ticker', async (req, res, next) => {
  try {
    const history = await getPriceHistory(req.params.ticker);
    if (!history.bars.length) return res.status(404).json({ error: 'No price data for ticker.' });
    const indicators = computeIndicators(history.bars);
    res.json({
      ticker: history.ticker,
      name: history.name,
      sector: history.sector,
      price: history.price,
      dataPoints: history.bars.length,
      series: indicators.series,
      latest: indicators.latest,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/stocks/:ticker/news — recent company news headlines. */
router.get('/:ticker/news', async (req, res, next) => {
  try {
    const name = await resolveName(req.params.ticker);
    const news = await getCompanyNews(req.params.ticker, name, {
      limit: Number(req.query.limit) || 20,
    });
    res.json({ ticker: req.params.ticker.toUpperCase(), company: name, count: news.length, news });
  } catch (err) {
    next(err);
  }
});

export default router;
