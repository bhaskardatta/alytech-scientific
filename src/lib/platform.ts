/** Everything that differs per host lives here (today Vercel; Cloudflare Workers headers are accepted too), so moving hosts is a one-file change. */
import { isIP } from 'node:net';

const dec = (v: string | null) => { try { return v ? decodeURIComponent(v) : null; } catch { return v; } };

export function clientIp(h: Headers, clientAddress?: string) {
  const raw = (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || h.get('cf-connecting-ip') || clientAddress || '').trim();
  return isIP(raw) ? raw : null; // the leads.ip column is inet: a junk header must not fail the insert
}

/** Country (ISO code) and city from the CDN's geo headers. */
export const geoOf = (h: Headers) => ({
  country: h.get('x-vercel-ip-country') || h.get('cf-ipcountry'),
  city: dec(h.get('x-vercel-ip-city') || h.get('cf-ipcity')),
});
