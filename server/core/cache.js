const { LRUCache } = require('lru-cache');

// Wraps an async function with a short-lived LRU cache keyed by its
// argument(s) -- the same stock symbol, news query, or web search query
// requested twice within `ttl` returns the cached result instead of hitting
// the external API again, cutting latency and avoiding upstream rate limits
// on free, no-key APIs (Yahoo Finance, Google News, DuckDuckGo) that have no
// SLA and can throttle repeated callers.
function memoizeAsync(fn, { max = 200, ttl, keyFn = (...args) => JSON.stringify(args) } = {}) {
  // Tests spin up a fresh fake upstream server per test() block but share
  // one process (and therefore one cache instance) across every test() in
  // a file -- caching would silently serve an earlier test's mocked
  // response to a later test expecting its own fake server's data. Disable
  // caching entirely under NODE_ENV=test rather than requiring every test
  // file to know a cache exists and reset it.
  if (process.env.NODE_ENV === 'test') return fn;

  const cache = new LRUCache({ max, ttl });
  return async function memoized(...args) {
    const key = keyFn(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const result = await fn(...args);
    cache.set(key, result);
    return result;
  };
}

module.exports = { memoizeAsync };
