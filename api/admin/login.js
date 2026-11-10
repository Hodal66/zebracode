import { checkCredentials, createSessionCookie, sameOriginJson } from '../../lib/auth.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false }); }
  if (!sameOriginJson(req)) return res.status(400).json({ ok: false, error: 'Bad request' });
  try {
    const { email, password } = req.body || {};
    const ok = checkCredentials(email, password);
    if (!ok) { await sleep(700); return res.status(401).json({ ok: false, error: 'Incorrect email or password.' }); }
    res.setHeader('Set-Cookie', createSessionCookie());
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('login misconfigured:', e.message);
    return res.status(500).json({ ok: false, error: 'Admin login is not configured yet.' });
  }
}
