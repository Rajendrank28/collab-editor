// backend/src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

/**
 * Rate limiting + slow-down middleware
 *
 * - slowDown: after a few rapid requests, responses slow (helps mitigate brute-force)
 * - rateLimit: hard cap that returns 429 after limit reached
 *
 * Tweak windowMs/max/slowDown parameters as needed for your environment.
 */

/* Slow down configuration (gradual) */
const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minute window
  delayAfter: 20, // allow 20 requests then start adding delay
  delayMs: 50, // add 50ms per request above delayAfter
});

/* Rate limit configuration (hard limit) */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute in ms
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: "Too many requests. Please try again later.",
  },
});

/* A stricter limiter for authentication endpoints */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8, // only 8 req/min per IP to login/register
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please wait a bit and try again.",
  },
});

export { speedLimiter, apiLimiter, authLimiter };
export default apiLimiter;
