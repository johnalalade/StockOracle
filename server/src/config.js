import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 4000,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
  marketCacheMs: Number(process.env.MARKET_CACHE_MS) || 5 * 60 * 1000,
  newsCacheMs: Number(process.env.NEWS_CACHE_MS) || 15 * 60 * 1000,
  // EODHD — primary (datacenter-friendly) live market data provider.
  eodhdApiKey: process.env.EODHD_API_KEY || '',
  // Exchange code for the Nigerian Exchange on EODHD (MIC XNSA). Override if
  // your EODHD plan uses a different code (verify via exchange-symbol-list).
  eodhdExchange: process.env.EODHD_EXCHANGE || 'XNSA',
  // How many days of daily history to request from EODHD (deep history that
  // AFX cannot provide — improves indicators and the backtest).
  eodhdHistoryDays: Number(process.env.EODHD_HISTORY_DAYS) || 400,
  // Default user-agent for scraping public market/news pages.
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 StockOracle/1.0',
};

export const hasLLM = Boolean(config.anthropicApiKey);
export const hasEODHD = Boolean(config.eodhdApiKey);
