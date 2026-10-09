/**
 * Everything that differs per host lives here, so moving hosts is a one-file change.
 * Vercel: x-forwarded-for / x-vercel-ip-* (set by Vercel, a client cannot override them).
 * Cloudflare Workers: cf-connecting-ip and request.cf. On that build the Vercel headers are NOT trusted (any client could send them),
 * and neither is x-forwarded-for, whose first entry is whatever the client wrote.
 */
import { isIP } from 'node:net';

const dec = (v: string | null | undefined) => { try { return v ? decodeURIComponent(v) : null; } catch { return v ?? null; } };

export function clientIp(h: Headers, clientAddress?: string) {
  const raw = (__CLOUDFLARE__
    ? h.get('cf-connecting-ip') || clientAddress || ''
    : h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || h.get('cf-connecting-ip') || clientAddress || '').trim();
  return isIP(raw) ? raw : null; // the leads.ip column is inet: a junk header must not fail the insert
}

/** `cf` is request.cf, only present on Cloudflare. */
type CfGeo = { country?: string; city?: string } | undefined;

/** Country (ISO code) and city from the CDN. */
export const geoOf = (h: Headers, cf?: CfGeo) => __CLOUDFLARE__
  ? { country: cf?.country || h.get('cf-ipcountry'), city: cf?.city || dec(h.get('cf-ipcity')) }
  : { country: h.get('x-vercel-ip-country') || h.get('cf-ipcountry'), city: dec(h.get('x-vercel-ip-city') || h.get('cf-ipcity')) };
