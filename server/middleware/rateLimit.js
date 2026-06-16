/**
 * Minimal dependency-free in-memory rate limiter (fixed window).
 *
 * Suitable for a single-process deployment. For multi-instance/clustered
 * deployments, replace the in-memory store with a shared store (e.g. Redis)
 * or adopt `express-rate-limit` with a Redis store. See audit SEC-010.
 */
const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 100, keyGenerator, message } = {}) {
  const getKey = keyGenerator || ((req) => req.ip || req.connection?.remoteAddress || 'unknown');

  return (req, res, next) => {
    const key = `${req.baseUrl}${req.path}:${getKey(req)}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.reset - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// Periodically purge expired buckets so the map does not grow unbounded.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now > entry.reset) buckets.delete(key);
  }
}, 5 * 60_000);
// Don't keep the process alive solely for the sweeper.
if (sweep.unref) sweep.unref();
