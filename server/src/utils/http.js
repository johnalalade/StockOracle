import { config } from '../config.js';

/**
 * Fetch a URL with a browser-like User-Agent and a timeout.
 * Returns the response body as text. Throws on non-2xx or timeout.
 */
export async function fetchText(url, { timeoutMs = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': config.userAgent, ...headers },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Simple TTL in-memory cache for scraped resources. */
export class TTLCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.at > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.map.set(key, { value, at: Date.now() });
    return value;
  }

  /** Get cached value or compute + store it. */
  async wrap(key, fn) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    return this.set(key, value);
  }
}
