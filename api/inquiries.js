// Public endpoint: POST /api/inquiries  (contact form + quote wizard)
import { insertInquiry, recentCountByIp } from '../lib/db.js';
import { clientIpHash, sameOriginJson } from '../lib/auth.js';
import { notifyNewInquiry } from '../lib/notify.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 10_000_000 ? Math.round(Number(v)) : null);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!sameOriginJson(req)) return res.status(400).json({ ok: false, error: 'Bad request' });

  const b = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: real visitors never see or fill this field. Pretend success so bots learn nothing.
  if (clean(b.website, 200)) return res.status(200).json({ ok: true });

  const data = {
    source: b.source === 'quote' ? 'quote' : 'contact',
    name: clean(b.name, 120),
    email: clean(b.email, 200).toLowerCase(),
    phone: clean(b.phone, 40),
    company: clean(b.company, 120),
    country: clean(b.country, 80),
    service: clean(b.service, 80),
    message: clean(b.message, 4000),
    project_type: clean(b.project_type, 80),
    complexity: clean(b.complexity, 40),
    timeline: clean(b.timeline, 40),
    estimate_low: num(b.estimate_low),
    estimate_high: num(b.estimate_high),
    user_agent: clean(req.headers['user-agent'], 300),
  };

  const errors = {};
  if (!data.name) errors.name = 'Please enter your full name.';
  if (!data.email) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (data.source === 'contact' && data.message.length < 10) errors.message = 'Please add a few details (at least 10 characters).';
  if (data.source === 'quote' && !data.project_type) errors.project_type = 'Please choose a project type.';
  if (Object.keys(errors).length) return res.status(422).json({ ok: false, error: 'Validation failed', errors });

  try {
    data.ip_hash = clientIpHash(req);
    if ((await recentCountByIp(data.ip_hash, 10)) >= 5) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please try again in a few minutes.' });
    }
    const row = await insertInquiry(data);
    await notifyNewInquiry(row); // never blocks success: failures are swallowed inside
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    console.error('inquiry failed:', err.message);
    return res.status(500).json({ ok: false, error: 'We could not save your request right now.' });
  }
}
