// Vercel serverless entry point.
//
// Vercel exposes files in /api as serverless functions. We reuse the same
// Express app the local server runs (createApp) and export it as the default
// handler — an Express app is itself a (req, res) handler, which Vercel invokes.
//
// vercel.json rewrites every /api/* request to this single function, so the
// existing route mounts (/api/stocks, /api/predict, /api/health) resolve as-is.
import { createApp } from '../server/src/app.js';

const app = createApp();

export default app;
