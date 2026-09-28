import { nyDate } from './common.mjs';

async function jsonFromMassive(path, params = {}) {
  if (!process.env.MASSIVE_API_KEY) throw new Error('MASSIVE_API_KEY is not configured');
  const url = new URL(path, 'https://api.massive.com');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.MASSIVE_API_KEY}` },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`Massive ${response.status} on ${url.pathname}; check plan access`);
  const data = await response.json();
  if (data.status === 'ERROR' || data.status === 'NOT_AUTHORIZED') {
    throw new Error(`Massive rejected ${url.pathname}: ${data.status}`);
  }
  return data;
}
async function latestBars(ticker, days = 8) {
  const until = nyDate();
  const from = nyDate(new Date(Date.now() - days * 86400000));
  const data = await jsonFromMassive(`/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${until}`, { limit: 15, sort: 'asc' });
  return (data.results || []).map(({ t, o, h, l, c }) => ({ at: new Date(t).toISOString(), open: o, high: h, low: l, close: c }));
}
async function rss(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
    const field = (item, name) => (item.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`)) || [,''])[1]
      .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();
    return items.map(([, item]) => ({ title: field(item, 'title'), url: field(item, 'link'), published: field(item, 'pubDate') }));
  } catch { return []; }
}
export async function forexEvidence() {
  const [eur, jpy, goldResult, fed, bls] = await Promise.all([
    latestBars('C:EURUSD'), latestBars('C:USDJPY'),
    latestBars('C:XAUUSD').then(bars => ({ bars, error: null })).catch(error => ({ bars: [], error: String(error.message) })),
    rss('https://www.federalreserve.gov/feeds/press_all.xml'),
    rss('https://www.bls.gov/feed/news_release/rss.xml')
  ]);
  if (!eur.length || !jpy.length) throw new Error('Forex daily bars are unavailable for EUR/USD or USD/JPY');
  const gold = goldResult.bars;
  const goldStatus = gold.length ? 'XAU/USD daily bars available.' : `XAU/USD daily bars unavailable${goldResult.error ? ` (${goldResult.error})` : ''}; do not invent gold levels.`;
  return { asOf: new Date().toISOString(), prices: { EURUSD: eur, USDJPY: jpy, XAUUSD: gold },
    goldStatus,
    ictPlan: {
      objective: 'Research whether the user’s ICT-inspired setup might form; do not place trades.',
      criteria: [
        'Establish higher-timeframe bias and prior daily/weekly high and low from timestamped bars.',
        'Mark Asia session high and low, then check whether London sweeps either level.',
        'After a sweep, check for displacement and a valid order block, FVG, or inverted FVG.',
        'Check Fibonacci retracement confluence, a chart-based invalidation level, and a daily high/low liquidity target.'
      ],
      available: `Recent daily bars for EUR/USD and USD/JPY${gold.length ? ' and XAU/USD' : ''}, plus public macro headlines.`,
      missing: `No intraday/session candles, current quote, weekly bars, or chart-derived ICT zones${gold.length ? '' : '; XAU/USD bars are unavailable'}; do not assert an entry.`
    },
    headlines: [...fed, ...bls],
    limitations: `Daily bars are not intraday prices; levels must be labeled as prior daily ranges. ICT entry conditions cannot be verified without session candles. ${goldStatus}` };
}
export async function stocksEvidence() {
  let grouped;
  for (let i = 1; i <= 5; i++) {
    const date = nyDate(new Date(Date.now() - i * 86400000));
    const data = await jsonFromMassive(`/v2/aggs/grouped/locale/us/market/stocks/${date}`, { adjusted: true });
    if (data.results?.length) { grouped = { date, rows: data.results }; break; }
  }
  if (!grouped) throw new Error('No prior-session U.S. stock aggregates available');
  const leaders = grouped.rows.filter(x => x.c > 2 && x.v > 100000)
    .map(x => ({ ticker: x.T, close: x.c, open: x.o, high: x.h, low: x.l,
      volume: x.v, changePct: +((x.c / x.o - 1) * 100).toFixed(2), dollarVolume: Math.round(x.c * x.v) }))
    .sort((a, b) => b.dollarVolume - a.dollarVolume).slice(0, 80);
  let news = { results: [] }, newsNote = '';
  try { news = await jsonFromMassive('/v2/reference/news', { limit: 30, order: 'desc', sort: 'published_utc' }); }
  catch (error) { console.warn('Stocks news unavailable:', error); newsNote = ' Massive stocks news was unavailable; headlines are omitted.'; }
  return { asOf: new Date().toISOString(), marketDate: grouped.date, marketCount: grouped.rows.length,
    liquidLeaders: leaders, headlines: (news.results || []).map(x => ({ title: x.title,
      url: x.article_url, published: x.published_utc, tickers: x.tickers || [] })),
    limitations: 'Grouped bars are prior-session, not current premarket prices. S&P 500 membership is not verified; no claim of a constituent-only scan or ICT entry.' + newsNote };
}
