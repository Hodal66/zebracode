// Admin only. GET = list + counts (also acts as the session check), PATCH = update status / notes.
import { isAuthed, sameOriginJson } from '../../lib/auth.js';
import { listInquiries, statusCounts, updateInquiry, STATUSES } from '../../lib/db.js';

const pub = ({ ip_hash, ...rest }) => rest; // never expose the hashed IP to the browser

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let authed = false;
  try { authed = isAuthed(req); } catch { return res.status(500).json({ ok: false, error: 'Admin is not configured.' }); }
  if (!authed) return res.status(401).json({ ok: false, error: 'Not signed in' });

  try {
    if (req.method === 'GET') {
      const status = STATUSES.includes(req.query.status) ? req.query.status : '';
      const q = String(req.query.q || '').slice(0, 100);
      const [items, counts] = await Promise.all([listInquiries({ status, q }), statusCounts()]);
      return res.status(200).json({ ok: true, items: items.map(pub), counts });
    }
    if (req.method === 'PATCH') {
      if (!sameOriginJson(req)) return res.status(400).json({ ok: false, error: 'Bad request' });
      const id = parseInt(req.body?.id, 10);
      const patch = {};
      if (req.body?.status !== undefined) {
        if (!STATUSES.includes(req.body.status)) return res.status(422).json({ ok: false, error: 'Invalid status' });
        patch.status = req.body.status;
      }
      if (req.body?.notes !== undefined) patch.notes = String(req.body.notes).slice(0, 5000);
      if (!id || !Object.keys(patch).length) return res.status(422).json({ ok: false, error: 'Nothing to update' });
      const row = await updateInquiry(id, patch);
      if (!row) return res.status(404).json({ ok: false, error: 'Not found' });
      return res.status(200).json({ ok: true, item: pub(row) });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ ok: false });
  } catch (e) {
    console.error('admin inquiries failed:', e.message);
    return res.status(500).json({ ok: false, error: 'Database error. Is Neon connected?' });
  }
}
