import { Router } from 'express';
import { predict } from '../services/PredictionService.js';

const router = Router();

/** POST /api/predict { ticker } — run the full hybrid prediction. */
router.post('/', async (req, res, next) => {
  try {
    const ticker = (req.body?.ticker || '').toString().trim();
    if (!ticker) return res.status(400).json({ error: 'ticker is required' });
    const result = await predict(ticker, { newsLimit: Number(req.body?.newsLimit) || 20 });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/predict/:ticker — convenience GET form. */
router.get('/:ticker', async (req, res, next) => {
  try {
    const result = await predict(req.params.ticker, { newsLimit: Number(req.query.newsLimit) || 20 });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
