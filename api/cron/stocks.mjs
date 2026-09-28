import { cronGuard, send } from '../../lib/common.mjs';
import { runAgent } from '../../lib/agent.mjs';
export default async function handler(req, res) {
  const gate = cronGuard(req, 'stocks');
  if (gate) return send(res, gate.status, gate);
  try { const report = await runAgent('stocks'); return send(res, 200, { ok: true, ranAt: report.ranAt }); }
  catch (error) { console.error('Stocks agent:', error); return send(res, 500, { ok: false, error: String(error.message) }); }
}
