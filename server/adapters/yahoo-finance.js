const { fetchWithTimeout } = require('../core/fetch-timeout');

const NAME = 'yahoo-finance';
const DEFAULT_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const TIMEOUT_MS = 15000;

module.exports = {
  name: NAME,
  isConfigured: () => true, // no API key needed
  async getQuote(symbol) {
    const baseUrl = process.env.YAHOO_FINANCE_BASE_URL || DEFAULT_BASE_URL;
    const res = await fetchWithTimeout(`${baseUrl}/${encodeURIComponent(symbol)}`, {}, TIMEOUT_MS);
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      throw new Error(`${NAME} returned no quote data for "${symbol}"`);
    }
    const price = meta.regularMarketPrice;
    const previousClose = meta.previousClose ?? meta.chartPreviousClose;
    const change = typeof previousClose === 'number' ? price - previousClose : null;
    const changePercent = typeof previousClose === 'number' && previousClose !== 0 ? (change / previousClose) * 100 : null;
    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      price,
      currency: meta.currency,
      change,
      changePercent,
      previousClose,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      exchange: meta.fullExchangeName || meta.exchangeName || null,
    };
  },
};
