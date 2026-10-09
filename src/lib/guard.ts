/** Abuse guards for /api/* and /admin/login: origin check, per-IP rate limit, admin login lockout. */
import { dbReady, count, insert } from './db';

const HOSTS = /^(www\.)?alytechme\.com$|\.vercel\.app$|^(localhost|127\.0\.0\.1)$/;

/** Browsers always send Origin (or Referer) on POST; both absent means a non-browser client, which is allowed. */
export function originOk(req: Request) {
  const src = req.headers.get('origin') || req.headers.get('referer');
  if (!src) return true;
  try { return HOSTS.test(new URL(src).hostname); } catch { return false; }
}

// ponytail: in-memory sliding window per serverless instance (resets on cold start, not shared across instances).
// Upgrade to Vercel WAF rate limiting or Upstash if abused.
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
const FAILS = 5, LOCK = 15 * MIN;

/** Shared across instances through the events table when the DB is up; the memory window covers the rest. */
export async function loginLocked(ip: string | null) {
  if (recent(`login:${ip}`, LOCK).length >= FAILS) return true;
  if (!ip || !dbReady()) return false;
  try {
    return (await count('events', `type=eq.admin_login_fail&data->>ip=eq.${encodeURIComponent(ip)}&ts=gte.${new Date(Date.now() - LOCK).toISOString()}`)) >= FAILS;
  } catch (e) {
    console.error('login lockout check failed', e);
    return false;
  }
}

export async function loginFailed(ip: string | null) {
  recent(`login:${ip}`, LOCK).push(Date.now());
  if (!ip || !dbReady()) return;
  try { await insert('events', { type: 'admin_login_fail', data: { ip } }); } catch (e) { console.error('login fail log failed', e); }
}
