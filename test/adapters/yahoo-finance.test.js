const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const yahooFinance = require('../../server/adapters/yahoo-finance.js');

function fakeQuoteServer(meta) {
  return http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ chart: { result: [{ meta }] } }));
  });
}

test('isConfigured is always true (no API key needed)', () => {
  assert.strictEqual(yahooFinance.isConfigured(), true);
});

test('getQuote parses price, change, and changePercent from the chart meta', async () => {
  const server = fakeQuoteServer({
    symbol: 'AAPL',
    longName: 'Apple Inc.',
    regularMarketPrice: 110,
    previousClose: 100,
    currency: 'USD',
    regularMarketDayHigh: 112,
    regularMarketDayLow: 108,
    fullExchangeName: 'NasdaqGS',
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.YAHOO_FINANCE_BASE_URL = `http://localhost:${server.address().port}`;

  const quote = await yahooFinance.getQuote('aapl');
  assert.strictEqual(quote.symbol, 'AAPL');
  assert.strictEqual(quote.name, 'Apple Inc.');
  assert.strictEqual(quote.price, 110);
  assert.strictEqual(quote.change, 10);
  assert.strictEqual(quote.changePercent, 10);
  assert.strictEqual(quote.currency, 'USD');

  server.close();
});

test('throws when the response has no usable quote data', async () => {
  const server = fakeQuoteServer({ symbol: 'BOGUS' });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.YAHOO_FINANCE_BASE_URL = `http://localhost:${server.address().port}`;

  await assert.rejects(() => yahooFinance.getQuote('BOGUS'), /returned no quote data/);

  server.close();
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.YAHOO_FINANCE_BASE_URL = `http://localhost:${server.address().port}`;

  await assert.rejects(() => yahooFinance.getQuote('AAPL'), /yahoo-finance http 500/);

  server.close();
});
