/** Single-password admin session: HMAC-signed, httpOnly cookie. */
import type { AstroCookies } from 'astro';

const SECRET = import.meta.env.ADMIN_SECRET as string | undefined;
const PASSWORD = import.meta.env.ADMIN_PASSWORD as string | undefined;
const COOKIE = 'aly_admin';
const TTL = 60 * 60 * 24 * 7; // 7 days

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sign(value: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(SECRET!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

/** Constant-time string compare (hash both sides first so lengths match). */
async function same(a: string, b: string) {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const ua = new Uint8Array(x), ub = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
}

export const authConfigured = () => Boolean(SECRET && PASSWORD && SECRET.length >= 32);

export async function login(password: string, cookies: AstroCookies) {
  if (!authConfigured() || !(await same(password, PASSWORD!))) return false;
  const exp = Math.floor(Date.now() / 1000) + TTL;
  cookies.set(COOKIE, `${exp}.${await sign(String(exp))}`, { path: '/admin/', httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict', maxAge: TTL });
  return true;
}

export async function isAdmin(cookies: AstroCookies) {
  if (!authConfigured()) return false;
  const [exp, sig] = (cookies.get(COOKIE)?.value ?? '').split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return same(sig, await sign(exp));
}

export const logout = (cookies: AstroCookies) => cookies.delete(COOKIE, { path: '/admin/' });
