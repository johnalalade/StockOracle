/**
 * Preprocessor
 *
 * Cleans/normalizes raw price bars and implements the Weekend & Holiday
 * Alignment Logic (methodology §3.4.2): news released while the market is
 * closed is attributed to the next trading day, so "overnight" information
 * shocks line up with the opening-bell price gap they actually move.
 */

/** Drop bad rows, de-dupe by date, sort ascending, coerce numerics. */
export function cleanBars(bars) {
  const seen = new Map();
  for (const b of bars) {
    if (!b?.date || b.close == null || !Number.isFinite(Number(b.close))) continue;
    seen.set(b.date, {
      date: b.date,
      close: Number(b.close),
      volume: b.volume == null ? null : Number(b.volume),
    });
  }
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Given a set of trading dates (YYYY-MM-DD, ascending) and dated news items,
 * map each news item to the first trading day at/after its publication.
 *
 * News published after Friday's close lands on Monday; this returns a map of
 * tradingDate -> news[] so the fundamental signal aligns with the bar it moves.
 *
 * @param {string[]} tradingDates  ascending ISO dates that have price bars
 * @param {Array<{date:string}>} news  items with ISO timestamps
 */
export function alignNewsToTradingDays(tradingDates, news) {
  const byDay = new Map(tradingDates.map((d) => [d, []]));
  if (!tradingDates.length) return byDay;

  for (const item of news) {
    if (!item.date) continue;
    const day = item.date.slice(0, 10);
    // First trading day >= the news day (covers weekends/holidays).
    let target = null;
    for (const td of tradingDates) {
      if (td >= day) {
        target = td;
        break;
      }
    }
    // News after the latest known bar attaches to that latest bar (it will
    // influence the *next, not-yet-traded* session we are predicting).
    if (!target) target = tradingDates[tradingDates.length - 1];
    byDay.get(target).push(item);
  }
  return byDay;
}

/** Min-max normalize an array to [0,1], ignoring nulls. */
export function normalize(values) {
  const valid = values.filter((v) => v != null && Number.isFinite(v));
  if (!valid.length) return values.map(() => null);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const span = max - min || 1;
  return values.map((v) => (v == null ? null : (v - min) / span));
}
