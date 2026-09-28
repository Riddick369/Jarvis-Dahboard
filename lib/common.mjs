import { get, put } from '@vercel/blob';

export const kinds = new Set(['forex', 'stocks']);
export function nyParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}
export function nyDate(date = new Date()) {
  const p = nyParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}
export function cronGuard(req, kind) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return { status: 401, error: 'Unauthorized' };
  }
  const p = nyParts();
  const expectedHour = kind === 'forex' ? 7 : 9;
  if (Number(p.hour) !== expectedHour || (kind === 'stocks' && ['Sat', 'Sun'].includes(p.weekday))) {
    return { status: 200, skipped: true, reason: 'Outside scheduled New York hour or weekday' };
  }
  return null;
}
export async function readReport(kind) {
  const result = await get(`reports/${kind}.json`, { access: 'private', useCache: false });
  if (!result) return null;
  return JSON.parse(await new Response(result.stream).text());
}
export async function saveReport(kind, report) {
  await put(`reports/${kind}.json`, JSON.stringify(report), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true
  });
}
export function send(res, status, data) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(data);
}
