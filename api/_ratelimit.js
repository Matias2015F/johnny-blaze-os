// Per-instance sliding window rate limiter.
// State resets on cold start — sufficient to block scripts and brute-force attempts.
// For distributed rate limiting across all instances, use Upstash Redis + @upstash/ratelimit.

const STORE = new Map();

const LIMITS = {
  "send-password-reset": { max: 5,   windowMs: 15 * 60 * 1000 },
  "mp-create-preference": { max: 10,  windowMs:  5 * 60 * 1000 },
  "send-welcome":         { max: 5,   windowMs: 60 * 60 * 1000 },
  "push-subscribe":       { max: 20,  windowMs: 60 * 60 * 1000 },
  "submit-rating":        { max: 12,  windowMs:       60 * 1000 },
  "receipt-incentive":    { max: 30,  windowMs:       60 * 1000 },
  "mp-diagnose":          { max: 5,   windowMs:       60 * 1000 },
  "mp-webhook":           { max: 200, windowMs:       60 * 1000 },
  "public-workshops":     { max: 30,  windowMs:       60 * 1000 },
  default:                { max: 60,  windowMs:       60 * 1000 },
};

// Purge stale entries every 10 minutes to prevent unbounded memory growth
let _cleanupScheduled = false;
function scheduleCleanup() {
  if (_cleanupScheduled) return;
  _cleanupScheduled = true;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of STORE.entries()) {
      if (now - entry.windowStart >= entry.windowMs) STORE.delete(key);
    }
  }, 10 * 60 * 1000);
}

/**
 * @param {string} ip  - Client IP address
 * @param {string} endpoint - Endpoint name key (matches LIMITS keys above)
 * @returns {{ limited: boolean, retryAfter?: number }}
 */
function checkRateLimit(ip, endpoint) {
  scheduleCleanup();

  const rule = LIMITS[endpoint] || LIMITS.default;
  const key = `${ip}:${endpoint}`;
  const now = Date.now();

  let entry = STORE.get(key);

  if (!entry || now - entry.windowStart >= rule.windowMs) {
    STORE.set(key, { count: 1, windowStart: now, windowMs: rule.windowMs });
    return { limited: false };
  }

  entry.count += 1;

  if (entry.count > rule.max) {
    const retryAfter = Math.ceil((rule.windowMs - (now - entry.windowStart)) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false };
}

/**
 * Convenience: apply rate limit and write 429 response if exceeded.
 * Returns true if the request was rate-limited (caller should return immediately).
 *
 * @param {object} req  - Vercel/Node request
 * @param {object} res  - Vercel/Node response
 * @param {string} endpoint
 */
function applyRateLimit(req, res, endpoint) {
  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  const result = checkRateLimit(ip, endpoint);

  if (result.limited) {
    res.setHeader("Retry-After", String(result.retryAfter));
    res.setHeader("X-RateLimit-Endpoint", endpoint);
    res.status(429).json({ error: "Demasiadas solicitudes. Intentá más tarde." });
    return true;
  }

  return false;
}

module.exports = { checkRateLimit, applyRateLimit };
