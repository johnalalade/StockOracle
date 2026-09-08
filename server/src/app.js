import express from 'express';
import cors from 'cors';
import { hasLLM, config } from './config.js';
import { logger } from './utils/logger.js';
import stocksRouter from './routes/stocks.js';
import predictRouter from './routes/predict.js';
import debugRouter from './routes/debug.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      llm: hasLLM ? `enabled (${config.llmModel})` : 'disabled (heuristic fallback)',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/stocks', stocksRouter);
  app.use('/api/predict', predictRouter);
  app.use('/api/debug', debugRouter);

  // 404
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error(err.stack || err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
