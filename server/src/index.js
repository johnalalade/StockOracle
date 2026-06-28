import { createApp } from './app.js';
import { config, hasLLM } from './config.js';
import { logger } from './utils/logger.js';

const app = createApp();

app.listen(config.port, () => {
  logger.info(`StockOracle API listening on http://localhost:${config.port}`);
  logger.info(`LLM fundamental analysis: ${hasLLM ? `Claude (${config.llmModel})` : 'heuristic fallback (no API key)'}`);
});
