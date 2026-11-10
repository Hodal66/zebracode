// Inquiry storage on Neon Postgres (DATABASE_URL, set by the Vercel <-> Neon integration).
// INQUIRY_STORE=memory is an explicit, test-only in-memory store; never set it in production.
import { neon } from '@neondatabase/serverless';

export const STATUSES = ['new', 'in_progress', 'won', 'lost', 'spam'];
const memory = [];
let memId = 0;
let sql = null;
let ready = null;

const useMemory = () => process.env.INQUIRY_STORE === 'memory';

function client() {
  if (!sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    sql = neon(url);
  }
  return sql;
}

async function init() {
  if (useMemory()) return;
  if (!ready) {
    ready = client().query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id            SERIAL PRIMARY KEY,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        source        TEXT NOT NULL,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL,
        phone         TEXT NOT NULL DEFAULT '',
        company       TEXT NOT NULL DEFAULT '',
        country       TEXT NOT NULL DEFAULT '',
        service       TEXT NOT NULL DEFAULT '',
        message       TEXT NOT NULL DEFAULT '',
        project_type  TEXT NOT NULL DEFAULT '',
        complexity    TEXT NOT NULL DEFAULT '',
        timeline      TEXT NOT NULL DEFAULT '',
        estimate_low  INTEGER,
        estimate_high INTEGER,
        status        TEXT NOT NULL DEFAULT 'new',
        notes         TEXT NOT NULL DEFAULT '',
        ip_hash       TEXT NOT NULL DEFAULT '',
        user_agent    TEXT NOT NULL DEFAULT ''
      )`).then(() => client().query('CREATE INDEX IF NOT EXISTS inquiries_created_idx ON inquiries (created_at DESC)'))
      .catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function recentCountByIp(ipHash, minutes = 10) {
  await init();
  if (useMemory()) return memory.filter((r) => r.ip_hash === ipHash && Date.now() - r.created_at.getTime() < minutes * 60000).length;
  const rows = await client().query(
    `SELECT count(*)::int AS n FROM inquiries WHERE ip_hash = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [ipHash, String(minutes)]
  );
  return rows[0].n;
}

export async function insertInquiry(d) {
  await init();
  if (useMemory()) {
    const row = { id: ++memId, created_at: new Date(), status: 'new', notes: '', ...d };
    memory.unshift(row);
    return row;
  }
  const rows = await client().query(
    `INSERT INTO inquiries (source,name,email,phone,company,country,service,message,project_type,complexity,timeline,estimate_low,estimate_high,ip_hash,user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [d.source, d.name, d.email, d.phone, d.company, d.country, d.service, d.message, d.project_type, d.complexity, d.timeline, d.estimate_low, d.estimate_high, d.ip_hash, d.user_agent]
  );
  return rows[0];
}

export async function listInquiries({ status = '', q = '', limit = 200 } = {}) {
  await init();
  limit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
  if (useMemory()) {
    const needle = q.toLowerCase();
    return memory
      .filter((r) => (!status || r.status === status) &&
        (!needle || [r.name, r.email, r.company, r.message, r.service, r.project_type].join(' ').toLowerCase().includes(needle)))
      .slice(0, limit);
  }
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (q) {
    params.push('%' + q.replace(/[%_\\]/g, '\\$&') + '%');
    where.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length} OR message ILIKE $${params.length} OR service ILIKE $${params.length} OR project_type ILIKE $${params.length})`);
  }
  params.push(limit);
  return client().query(
    `SELECT * FROM inquiries ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
}

export async function statusCounts() {
  await init();
  if (useMemory()) {
    const out = {};
    memory.forEach((r) => { out[r.status] = (out[r.status] || 0) + 1; });
    return out;
  }
  const rows = await client().query('SELECT status, count(*)::int AS n FROM inquiries GROUP BY status');
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export async function updateInquiry(id, { status, notes }) {
  await init();
  if (useMemory()) {
    const row = memory.find((r) => r.id === id);
    if (!row) return null;
    if (status !== undefined) row.status = status;
    if (notes !== undefined) row.notes = notes;
    return row;
  }
  const rows = await client().query(
    `UPDATE inquiries SET status = COALESCE($2, status), notes = COALESCE($3, notes) WHERE id = $1 RETURNING *`,
    [id, status ?? null, notes ?? null]
  );
  return rows[0] || null;
}
