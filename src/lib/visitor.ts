/** Request metadata: IP, Vercel geo headers, and (optionally) the network owner of the IP. */
const token = import.meta.env.IPINFO_TOKEN as string | undefined;
const orgCache = new Map<string, string | null>(); // ponytail: per-instance cache; fine at this traffic level

export function requestInfo(req: Request, clientAddress?: string) {
  const h = req.headers;
  const ip = (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || clientAddress || '').trim() || null;
  const dec = (v: string | null) => (v ? decodeURIComponent(v) : null);
  return {
    ip,
    geo_country: h.get('x-vercel-ip-country'),
    geo_city: dec(h.get('x-vercel-ip-city')),
    user_agent: h.get('user-agent')?.slice(0, 400) ?? null,
  };
}

/** e.g. "AS8966 Emirates Telecommunications" (ISP) or "AS204006 Abu Dhabi National Oil Company" (company network). */
export async function ipOrg(ip: string | null) {
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

/** Trim and cap every string field so a hostile client can't stuff the DB. */
export const clean = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);
