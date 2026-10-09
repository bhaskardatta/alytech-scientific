/** Abuse guards for /api/* and /admin/login: origin check, per-IP rate limit, admin login lockout. */
import { dbReady, count, insert } from './db';

// www + apex + the admin host, Vercel previews, and this Worker's workers.dev URLs (alytech-scientific.<account>.workers.dev and its version previews).
const HOSTS = /^((www|admin)\.)?alytechme\.com$|\.vercel\.app$|(^|[.-])alytech-scientific\.[a-z0-9-]+\.workers\.dev$|^(localhost|127\.0\.0\.1)$/;

/** Browsers always send Origin (or Referer) on POST; both absent means a non-browser client, which is allowed. */
export function originOk(req: Request) {
  const src = req.headers.get('origin') || req.headers.get('referer');
  if (!src) return true;
  try {
    const from = new URL(src).hostname;
    return HOSTS.test(from) || from === new URL(req.url).hostname; // same host as the request itself: still right after a move to another host or domain
  } catch { return false; }
}

// ponytail: in-memory sliding window per serverless instance (resets on cold start, not shared across instances).
// Upgrade to Vercel WAF / Cloudflare rate limiting rules (or Upstash) if abused.
const hits = new Map<string, number[]>();
const MIN = 60_000;

function recent(key: string, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 15 * MIN) hits.delete(k); // longest window we use is 15 min
  return list;
}

/** Counts this call and returns true once `key` has been used `max` times within the window. */
export function limited(key: string, max: number, windowMs = 10 * MIN) {
  const list = recent(key, windowMs);
  if (list.length >= max) return true;
  list.push(Date.now());
  return false;
}

// ---------- Admin login lockout ----------
// Keyed per IP + email: 5 wrong passwords for one account from one address lock that pair for 15 minutes, and 25 from one address
// (guessing across many emails) lock the address. A locked pair is refused before the password is looked at.
const FAILS = 5, IP_FAILS = 25, LOCK = 15 * MIN;
const since = () => `ts=gte.${new Date(Date.now() - LOCK).toISOString()}`;

/** Shared across instances through the events table when the DB is up; the memory window covers the rest. */
export async function loginLocked(ip: string | null, email: string) {
  email = email.trim().toLowerCase().slice(0, 200);
  if (recent(`login:${ip}|${email}`, LOCK).length >= FAILS || recent(`login-ip:${ip}`, LOCK).length >= IP_FAILS) return true;
  if (!ip || !dbReady()) return false;
  try {
    const base = `type=eq.admin_login_fail&data->>ip=eq.${encodeURIComponent(ip)}&${since()}`;
    const [pair, all] = await Promise.all([count('events', `${base}&data->>email=eq.${encodeURIComponent(email)}`), count('events', base)]);
    return pair >= FAILS || all >= IP_FAILS;
  } catch (e) {
    console.error('login lockout check failed', e);
    return false;
  }
}

export async function loginFailed(ip: string | null, email: string) {
  email = email.trim().toLowerCase().slice(0, 200);
  recent(`login:${ip}|${email}`, LOCK).push(Date.now());
  recent(`login-ip:${ip}`, LOCK).push(Date.now());
  if (!ip || !dbReady()) return;
  try { await insert('events', { type: 'admin_login_fail', data: { ip, email } }); } catch (e) { console.error('login fail log failed', e); }
}
