/**
 * Refresh the bundled NGX seed snapshot from live AFX data.
 *
 * WHY THIS EXISTS: AFX (the free live price source) blocks datacenter IPs
 * (Vercel, Render, GitHub runners, etc.), but serves normal residential
 * connections fine. So the snapshot is refreshed HERE — on your own machine —
 * then committed and deployed. Vercel serves this snapshot as a graceful
 * fallback whenever live scraping is unavailable.
 *
 * Usage (from the repo root):   npm run seed:refresh
 * or with a subset:             npm run seed:refresh -- GTCO ZENITHBANK MTNN
 *
 * The run only ever ADDS/updates coverage — existing tickers are preserved if
 * a fetch fails, so you can re-run to fill gaps. News sentiment is always live
 * at request time and is not part of this snapshot.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchEquityList, fetchTicker } from '../src/providers/ngxMarketProvider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../src/seed');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const banner =
  '// Auto-generated seed snapshot of live NGX data (fallback when live scraping\n' +
  '// is unavailable, e.g. blocked from a serverless datacenter IP).\n' +
  '// Regenerate with:  npm run seed:refresh\n';

const write = (file, data) =>
  fs.writeFileSync(path.join(OUT, file), banner + 'export default ' + JSON.stringify(data) + ';\n');

// Preserve any existing history so partial runs only add coverage.
let history = {};
try {
  history = (await import('file://' + path.join(OUT, 'history.js') + '?t=' + Date.now())).default;
} catch {
  /* start fresh */
}

const onlyArg = process.argv.slice(2).map((s) => s.toUpperCase());

console.log('Fetching NGX equities list…');
const list = await fetchEquityList();
if (list.length) write('equities.js', list);
console.log(`  ${list.length} equities.`);

const targets = onlyArg.length ? list.filter((e) => onlyArg.includes(e.ticker)) : list;
console.log(`Fetching price history for ${targets.length} tickers (gentle pacing)…`);

let ok = 0;
let i = 0;
for (const e of targets) {
  i += 1;
  let done = false;
  for (let attempt = 0; attempt < 3 && !done; attempt += 1) {
    try {
      const t = await fetchTicker(e.ticker);
      const bars = (t.bars || []).map((b) => ({ date: b.date, close: b.close, volume: b.volume }));
      if (bars.length && t.source !== 'cached') {
        history[e.ticker] = { name: t.name || e.name, sector: t.sector || null, bars };
        ok += 1;
        done = true;
      } else {
        await sleep(500 * (attempt + 1));
      }
    } catch {
      await sleep(700 * (attempt + 1));
    }
  }
  if (i % 10 === 0) {
    write('history.js', history);
    process.stdout.write(`  ${i}/${targets.length}  (${ok} fetched, ${Object.keys(history).length} total)\n`);
  }
  await sleep(400);
}

write('history.js', history);
console.log(`Done. ${ok} tickers fetched this run; ${Object.keys(history).length} tickers in snapshot.`);
console.log('Commit server/src/seed/*.js and redeploy to publish the refreshed snapshot.');
