const express = require('express');
const { requireAuth } = require('./auth');
const yahooFinance = require('./adapters/yahoo-finance');
const googleNews = require('./adapters/google-news');

const MAX_SYMBOL_LENGTH = 12;
const MAX_QUERY_LENGTH = 200;
const SYMBOL_PATTERN = /^[A-Za-z0-9.\-^=]+$/;

const financeNewsRouter = express.Router();

financeNewsRouter.get('/finance', requireAuth, async (req, res) => {
  const symbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
  if (!symbol) return res.status(400).json({ error: 'symbol required' });
  if (symbol.length > MAX_SYMBOL_LENGTH || !SYMBOL_PATTERN.test(symbol)) {
    return res.status(400).json({ error: 'invalid symbol' });
  }

  try {
    const quote = await yahooFinance.getQuote(symbol);
    res.json({ quote });
  } catch (err) {
    console.warn(`[finance-news] quote lookup failed: ${err.message}`);
    res.status(503).json({ error: 'OmniAgent finance data is temporarily unavailable, try again shortly' });
  }
});

financeNewsRouter.get('/news', requireAuth, async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) return res.status(400).json({ error: 'q required' });
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `query too long (max ${MAX_QUERY_LENGTH} characters)` });
  }

  try {
    const headlines = await googleNews.search(query);
    res.json({ headlines });
  } catch (err) {
    console.warn(`[finance-news] news search failed: ${err.message}`);
    res.status(503).json({ error: 'OmniAgent news search is temporarily unavailable, try again shortly' });
  }
});

module.exports = { financeNewsRouter };
