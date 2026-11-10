// Minimal stateless admin auth: HMAC-signed, HttpOnly session cookie. No third-party deps.
import crypto from 'node:crypto';

const COOKIE = 'zc_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

const b64u = (b) => Buffer.from(b).toString('base64url');
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 24) throw new Error('SESSION_SECRET must be set (24+ chars)');
  return s;
};
const hmac = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkCredentials(email, password) {
  const e = process.env.ADMIN_EMAIL, p = process.env.ADMIN_PASSWORD;
  if (!e || !p) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD are not configured');
  // evaluate both so timing does not reveal which one was wrong
  const okEmail = safeEqual(String(email || '').trim().toLowerCase(), e.trim().toLowerCase());
  const okPass = safeEqual(password || '', p);
  return okEmail && okPass;
}

export function createSessionCookie() {
  const payload = b64u(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const token = payload + '.' + hmac(payload);
  const secure = process.env.NODE_ENV === 'test' || process.env.INQUIRY_STORE === 'memory' ? '' : '; Secure';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function isAuthed(req) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!m) return false;
  const [payload, sig] = m.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  try {
    if (!safeEqual(sig, hmac(payload))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// Block cross-site writes: require JSON content type + same-origin Origin header when present.
export function sameOriginJson(req) {
  if (!String(req.headers['content-type'] || '').includes('application/json')) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function clientIpHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHmac('sha256', secret()).update(ip).digest('hex').slice(0, 32);
}
