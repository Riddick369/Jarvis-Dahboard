import { readReport, send } from '../lib/common.mjs';
export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return send(res, 200, { configured: false, reports: {} });
    const [forex, stocks] = await Promise.all(['forex', 'stocks'].map(readReport));
    return send(res, 200, { configured: true, reports: { forex, stocks } });
  } catch (error) {
    console.error('Read reports:', error);
    return send(res, 500, { error: 'Unable to read saved reports' });
  }
}
