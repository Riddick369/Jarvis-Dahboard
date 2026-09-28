import { forexEvidence, stocksEvidence } from './sources.mjs';
import { saveReport } from './common.mjs';

async function analyze(kind, evidence) {
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('AI Gateway authentication is unavailable');
  const system = `You are the ${kind === 'forex' ? 'Forex macro' : 'U.S. stocks'} analyst for Jarvis.
Use ONLY supplied evidence. No trade orders. Separate confirmed observations from inference and missing data.
Keep the report under 500 words. Include source URLs and evidence timestamps.
Never claim current intraday levels from daily bars. Never claim S&P 500 constituent coverage without membership data.
For Forex, include a distinct "ICT plan check" for EUR/USD and USD/JPY. Apply the supplied plan criteria one by one. Mark each as "supported by daily data", "needs intraday chart", or "not established" and briefly explain why. Daily candles may establish prior daily ranges and broad context, but cannot verify an Asia/London sweep, displacement, order block, FVG/inverted FVG, Fibonacci entry, or current invalidation. Do not infer them from macro headlines. State the precise chart evidence needed next and identify prior daily range boundaries as historical, never live support/resistance.
Never issue a take-trade verdict if current chart data is insufficient. Return a practical watchlist and what to verify next.`;
  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST', signal: AbortSignal.timeout(45000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.AI_MODEL || 'openai/gpt-5-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(evidence) }],
      max_completion_tokens: 1800, stream: false })
  });
  if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const result = await response.json();
  const narrative = result.choices?.[0]?.message?.content;
  if (!narrative) throw new Error('AI Gateway returned no report');
  return narrative;
}
export async function runAgent(kind) {
  const evidence = await (kind === 'forex' ? forexEvidence() : stocksEvidence());
  const narrative = await analyze(kind, evidence);
  const report = { kind, ranAt: new Date().toISOString(), evidenceAt: evidence.asOf,
    marketDate: evidence.marketDate || null, narrative,
    sources: evidence.headlines.map(x => ({ title: x.title, url: x.url, published: x.published })).filter(x => x.url).slice(0, 12),
    limitations: evidence.limitations };
  await saveReport(kind, report);
  return report;
}
