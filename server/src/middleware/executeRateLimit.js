/**
 * Lightweight per-user rate limit for /api/execute (no extra dependency).
 * ~20 runs per rolling minute, then 429.
 */
const ApiError = require('../utils/ApiError');

const WINDOW_MS = 60_000;
const MAX_RUNS = 20;

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map();

function executeRateLimit(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next(
        new ApiError(401, 'Unauthorized request - no token provided'),
      );
    }

    const now = Date.now();
    let entry = buckets.get(userId);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      buckets.set(userId, entry);
    }

    entry.count += 1;
    if (entry.count > MAX_RUNS) {
      return next(
        new ApiError(
          429,
          'Too many code runs. Please wait about a minute and try again.',
        ),
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = executeRateLimit;
