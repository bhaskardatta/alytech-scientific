/** Request metadata: IP, geo headers, and (optionally) the network owner of the IP. */
import { clientIp, geoOf } from './platform';
import { secret } from './env';

const orgCache = new Map<string, string | null>(); // ponytail: per-instance cache; fine at this traffic level

export function requestInfo(req: Request, clientAddress?: string) {
  const geo = geoOf(req.headers, (req as Request & { cf?: { country?: string; city?: string } }).cf); // cf: Cloudflare only
  return {
    ip: clientIp(req.headers, clientAddress),
    geo_country: geo.country,
    geo_city: geo.city,
    user_agent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
  };
}

/** e.g. "AS8966 Emirates Telecommunications" (ISP) or "AS204006 Abu Dhabi National Oil Company" (company network). */
export async function ipOrg(ip: string | null) {
  const token = secret('IPINFO_TOKEN');
  if (!ip || !token) return null;
  if (orgCache.has(ip)) return orgCache.get(ip)!;
  try {
    const res = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/org?token=${token}`, { signal: AbortSignal.timeout(1500) });
    const org = res.ok ? (await res.text()).trim() || null : null;
    orgCache.set(ip, org);
    return org;
  } catch {
    return null;
  }
}

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor/i;
export const isBot = (ua: string | null) => !ua || BOT.test(ua);

/** Coarse device class from the user agent. The user agent itself is not stored for page views. */
export const deviceOf = (ua: string | null) => (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua ?? '') ? 'tablet' : /mobi|iphone|ipod|android|windows phone/i.test(ua ?? '') ? 'mobile' : 'desktop');

/** Host only ("google.com") from a referrer URL: path and query can carry personal data, so anonymous counting never keeps them. */
export function hostOf(url: unknown) {
  if (typeof url !== 'string' || !url) return null;
  try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 120) || null; } catch { return null; }
}

/** Trim and cap every string field so a hostile client can't stuff the DB. */
export const clean = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

/** Campaign keys we keep from the landing URL (mirrors scripts/lead.ts). Anything else is dropped. */
export const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'li_fat_id'] as const;

export function cleanAttribution(v: unknown) {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, string> = {};
  for (const k of ATTR_KEYS) { const s = clean((v as Record<string, unknown>)[k], 200); if (s) out[k] = s; }
  return Object.keys(out).length ? out : null;
}

/** The three utm tags of the current page's URL, for source reports. Click ids (gclid …) are deliberately not kept for anonymous counting. */
export function cleanUtm(v: unknown) {
  const a = cleanAttribution(v);
  if (!a) return null;
  const out: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) if (a[k]) out[k] = a[k];
  return Object.keys(out).length ? out : null;
}
