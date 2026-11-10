import { isAuthed } from '../../lib/auth.js';
import { listInquiries } from '../../lib/db.js';

// Neutralise spreadsheet formula injection (=, +, -, @) and quote CSV fields.
const cell = (v) => {
  let s = v instanceof Date ? v.toISOString() : String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let authed = false;
  try { authed = isAuthed(req); } catch { return res.status(500).end('Admin is not configured.'); }
  if (!authed) return res.status(401).end('Not signed in');
  try {
    const rows = await listInquiries({ limit: 1000 });
    const cols = ['id', 'created_at', 'status', 'source', 'name', 'email', 'phone', 'company', 'country', 'service', 'project_type', 'complexity', 'timeline', 'estimate_low', 'estimate_high', 'message', 'notes'];
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zebracode-inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send('﻿' + csv);
  } catch (e) {
    console.error('export failed:', e.message);
    return res.status(500).end('Database error');
  }
}
