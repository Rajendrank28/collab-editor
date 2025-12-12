// backend/src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

/**
 * Rate limiting + slow-down middleware
 *
 * - slowDown: after a few rapid requests, responses slow (mitigates brute-force)
 * - rateLimit: hard cap that returns 429 after limit reached
 *
 * Note: express-slow-down recently changed how delayMs is validated.
 * Use delayMs: () => <ms> or set options.validate: { delayMs: false }.
 */

// Slow down configuration (gradual)
// We return a constant delay per extra request — simple and compatible.
export const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minute window
  delayAfter: 20, // allow 20 requests then start adding delay
  // new recommended style: function returning a delay in ms
  delayMs: () => 50, // add 50ms per request after the threshold
  // optional: turn off built-in warning validation (not needed here)
  // validate: { delayMs: false }
});

// Rate limit configuration (hard limit)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again later.",
  },
});

// A stricter limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again later.",
  },
});

export default apiLimiter;
