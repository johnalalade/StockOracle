import equities from './equities.js';
import history from './history.js';

/**
 * Bundled snapshot of live NGX data, used as a graceful fallback when live
 * scraping is unavailable (e.g. the source blocks the serverless datacenter
 * IP). Same "always works" philosophy as the LLM heuristic fallback.
 */
export const seedEquities = equities;
export const seedHistory = history; // { TICKER: { name, sector, bars } }

export function seedTicker(ticker) {
  return history[ticker.toUpperCase()] || null;
}

// Latest date present in the snapshot, for "as of" labelling in the UI.
export const seedAsOf = (() => {
  let latest = '';
  for (const v of Object.values(history)) {
    for (const b of v.bars) if (b.date > latest) latest = b.date;
  }
  return latest || null;
})();
