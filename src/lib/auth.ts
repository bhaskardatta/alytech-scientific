/**
 * Admin accounts. Passwords: PBKDF2-SHA256 (WebCrypto), stored as "pbkdf2$iterations$salt$hash" (hex). Session: httpOnly cookie signed with
 * HMAC (ADMIN_SECRET) that names the user; every request re-reads the user, so deactivating an account or changing its password ends its sessions.
 *
 * Two non-database sessions exist: "bootstrap" (ADMIN_PASSWORD while no account exists yet; only good for creating the first owner)
 * and "breakglass" (ADMIN_PASSWORD with ADMIN_BREAKGLASS=1, an owner login for emergencies).
 */
import type { AstroCookies } from 'astro';
import { secret } from './env';
import { dbReady, select, update, count, rpc } from './db';

export type Role = 'owner' | 'sales' | 'viewer';
export interface AdminUser { id: string | null; email: string; name: string; role: Role; mustChange: boolean; kind: 'user' | 'breakglass' | 'bootstrap' }

const COOKIE = 'aly_admin';
const TTL = 60 * 60 * 24 * 7; // 7 days
// Legacy PBKDF2 hashes (before bcrypt-in-Postgres): Workers WebCrypto caps iterations at 100k, so higher counts are rejected.
const ITERATIONS = 100_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf as ArrayBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));

// ---------- passwords ----------
async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256));
}

function equalBytes(a: Uint8Array, b: Uint8Array) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * New hashes are bcrypt (cost 10), computed by Postgres (pgcrypto) through admin_hash_password(): the slow part runs in the database, not in
 * the request, so Cloudflare Workers' 10 ms CPU limit on the free plan never trips on a sign-in. Older "pbkdf2$" hashes still verify locally
 * and are upgraded to bcrypt on the next successful sign-in.
 */
export async function hashPassword(password: string) {
  return rpc<string>('admin_hash_password', { p: password });
}

export async function verifyPassword(password: string, stored: string) {
  if (stored?.startsWith('$2')) return (await rpc<boolean>('admin_check_password', { p: password, h: stored })) === true;
  return verifyPbkdf2(password, stored);
}

async function verifyPbkdf2(password: string, stored: string) {
  const [alg, iter, salt, hash] = (stored ?? '').split('$');
  const iterations = Number(iter);
  if (alg !== 'pbkdf2' || !salt || !hash || !(iterations >= 1000 && iterations <= ITERATIONS)) return false;
  return equalBytes(await derive(password, unhex(salt), iterations), unhex(hash));
}

let dummy: Promise<string> | undefined;
/** Burn the same time as a real check so an unknown email can't be told apart from a wrong password by timing. */
const spendTime = async (password: string) => { await verifyPassword(password, await (dummy ??= hashPassword('not-a-real-password'))); };

/** Why a new password is unacceptable, or '' when it is fine. */
export const passwordProblem = (pw: string) =>
  pw.length < 10 ? 'Use at least 10 characters.' : new TextEncoder().encode(pw).length > 72 ? 'Use at most 72 characters.' : ''; // bcrypt reads 72 bytes

/** One-time password for new accounts and resets: 14 characters without look-alikes (0/O, 1/l/I). */
export function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const limit = 256 - (256 % alphabet.length); // reject the top few byte values so every character is equally likely
  const out: string[] = [];
  while (out.length < 14) for (const b of crypto.getRandomValues(new Uint8Array(24))) if (b < limit && out.length < 14) out.push(alphabet[b % alphabet.length]);
  return out.join('');
}

// ---------- session cookie ----------
const SECRET = () => secret('ADMIN_SECRET');
export const authConfigured = () => (SECRET()?.length ?? 0) >= 32;

async function sign(value: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET()!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

/** Constant-time string compare (hash both sides first so lengths match). */
export async function same(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return equalBytes(new Uint8Array(x), new Uint8Array(y));
}

/** Ties a session to the current password: changing or resetting it signs the account out everywhere else. */
const fingerprint = async (passwordHash: string) => (await sign(`pw:${passwordHash}`)).slice(0, 16);

export async function startSession(cookies: AstroCookies, sub: string, passwordHash = '') {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const fp = passwordHash ? await fingerprint(passwordHash) : '0';
  const body = `${sub}.${exp}.${fp}`;
  // path '/': on the admin host (ADMIN_HOST, src/worker.ts) the browser's URLs have no /admin prefix. The cookie only ever authenticates /admin/* routes.
  cookies.set(COOKIE, `${body}.${await sign(body)}`, { path: '/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict', maxAge: TTL });
}

export const logout = (cookies: AstroCookies) => cookies.delete(COOKIE, { path: '/' });

/** True while there is no admin account at all (also when the database isn't reachable yet), i.e. the one-time setup is allowed. */
export async function usersEmpty() {
  if (!dbReady()) return true;
  try { return (await count('admin_users', 'id=not.is.null')) === 0; } catch (e) { return /PGRST20[25]|42P01/.test(String(e)); } // missing table = schema not run yet
}

const breakglassOn = () => secret('ADMIN_BREAKGLASS') === '1' && Boolean(secret('ADMIN_PASSWORD'));
const bootstrapUser: AdminUser = { id: null, email: 'setup', name: 'First-time setup', role: 'owner', mustChange: false, kind: 'bootstrap' };
const breakglassUser: AdminUser = { id: null, email: 'breakglass', name: 'Break-glass owner', role: 'owner', mustChange: false, kind: 'breakglass' };

/** The signed-in admin for this request, or null. Reads the database each time (cheap, and keeps deactivation immediate). */
export async function currentUser(cookies: AstroCookies): Promise<AdminUser | null> {
  if (!authConfigured()) return null;
  const parts = (cookies.get(COOKIE)?.value ?? '').split('.');
  if (parts.length !== 4) return null;
  const [sub, exp, fp, sig] = parts;
  if (!(Number(exp) > Date.now() / 1000) || !(await same(sig, await sign(`${sub}.${exp}.${fp}`)))) return null;
  if (sub === 'breakglass') return breakglassOn() ? breakglassUser : null;
  if (sub === 'bootstrap') return (await usersEmpty()) ? bootstrapUser : null;
  if (!UUID.test(sub) || !dbReady()) return null;
  try {
    const [u] = await select('admin_users', `select=id,email,name,role,active,must_change_password,password_hash&id=eq.${sub}`);
    if (!u?.active || fp !== (await fingerprint(u.password_hash))) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role, mustChange: u.must_change_password, kind: 'user' };
  } catch (e) {
    console.error('session lookup failed', e);
    return null;
  }
}

/**
 * Check an email + password. On success returns the user and starts their session; null on any failure (callers count failures for the lockout).
 * While no account exists, only ADMIN_PASSWORD works (setup session). Afterwards ADMIN_PASSWORD only works as break-glass, with email "breakglass".
 */
export async function signIn(email: string, password: string, cookies: AstroCookies): Promise<AdminUser | null> {
  if (!authConfigured() || !password) return null;
  email = email.trim().toLowerCase();
  const adminPassword = secret('ADMIN_PASSWORD');
  if (await usersEmpty()) {
    if (adminPassword && (await same(password, adminPassword))) { await startSession(cookies, 'bootstrap'); return bootstrapUser; }
    return null;
  }
  if (email === 'breakglass') {
    if (breakglassOn() && (await same(password, adminPassword!))) { await startSession(cookies, 'breakglass'); return breakglassUser; }
    await spendTime(password);
    return null;
  }
  let u: any;
  try { [u] = await select('admin_users', `select=id,email,name,role,active,must_change_password,password_hash&email=eq.${encodeURIComponent(email)}`); } catch (e) { console.error('login lookup failed', e); }
  if (!u) { await spendTime(password); return null; }
  if (!(await verifyPassword(password, u.password_hash)) || !u.active) return null;
  if (u.password_hash.startsWith('pbkdf2$')) {
    // One-time upgrade to the database-side bcrypt hash (see hashPassword). A failure here just leaves the old hash in place.
    try { const h = await hashPassword(password); await update('admin_users', `id=eq.${u.id}`, { password_hash: h }); u.password_hash = h; }
    catch (e) { console.error('password hash upgrade failed', e); }
  }
  await startSession(cookies, u.id, u.password_hash);
  update('admin_users', `id=eq.${u.id}`, { last_login_at: new Date().toISOString() }).catch((e) => console.error('last_login update failed', e));
  return { id: u.id, email: u.email, name: u.name, role: u.role, mustChange: u.must_change_password, kind: 'user' };
}

// ---------- permissions ----------
// read: every role. write: owner + sales (leads, notes, assignments, WhatsApp conversion). owner: settings, users, activity log, deleting leads.
export type Perm = 'read' | 'write' | 'owner';
const RANK: Record<Role, number> = { viewer: 1, sales: 2, owner: 3 };
const NEED: Record<Perm, number> = { read: 1, write: 2, owner: 3 };
export const can = (u: AdminUser | null | undefined, perm: Perm) => Boolean(u && u.kind !== 'bootstrap' && RANK[u.role] >= NEED[perm]);
