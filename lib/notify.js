// Optional email alert through Resend. Silently skipped if RESEND_API_KEY is not set.
export async function notifyNewInquiry(row) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'not configured' };
  const to = process.env.NOTIFY_EMAIL || 'zebracode250@gmail.com';
  const from = process.env.NOTIFY_FROM || 'ZEBRACODE <onboarding@resend.dev>';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lines = [
    ['Source', row.source], ['Name', row.name], ['Email', row.email], ['Phone', row.phone], ['Company', row.company],
    ['Country', row.country], ['Service', row.service], ['Project type', row.project_type], ['Complexity', row.complexity],
    ['Timeline', row.timeline],
    ['Estimate', row.estimate_low ? `$${row.estimate_low} – $${row.estimate_high}` : ''],
  ].filter(([, v]) => v);
  const html = `<h2>New ZEBRACODE inquiry #${row.id}</h2><table cellpadding="6">${lines.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v)}</td></tr>`).join('')}</table><p style="white-space:pre-wrap">${esc(row.message)}</p>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: row.email, subject: `New inquiry from ${row.name}`, html }),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}
