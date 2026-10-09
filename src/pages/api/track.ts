import type { APIRoute } from 'astro';
import { dbReady, insert } from '../../lib/db';
import { requestInfo, ipOrg, isBot, clean } from '../../lib/visitor';
import { originOk, limited } from '../../lib/guard';

export const prerender = false;

const TYPES = new Set(['pageview', 'lead_open', 'search', 'nudge']);

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!originOk(request)) return new Response(null, { status: 403 });
  const raw = await request.text();
  if (raw.length > 4_000) return new Response(null, { status: 413 });
  let b: Record<string, any>;
  try { b = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
  const meta = requestInfo(request, clientAddress);
  if (!TYPES.has(b.type) || isBot(meta.user_agent)) return new Response(null, { status: 204 });
  if (limited(`track:${meta.ip}`, 120)) return new Response(null, { status: 429 }); // before the IPinfo lookup below

  const { type, visitorId, sessionId, path, title, product, referrer, lang, ...rest } = b;
  delete rest.ts;
  const row = {
    type,
    visitor_id: clean(visitorId, 64),
    session_id: clean(sessionId, 64),
    path: clean(path, 300),
    title: clean(title, 300),
    product: clean(product, 200),
    referrer: clean(referrer, 500),
    lang: lang === 'ar' ? 'ar' : 'en',
    ip_org: await ipOrg(meta.ip),
    geo_country: meta.geo_country,
    geo_city: meta.geo_city,
    data: !Object.keys(rest).length ? null : JSON.stringify(rest).length <= 2000 ? rest : { truncated: true },
  };

  if (!dbReady()) { console.log('[track]', row.type, row.path, row.data ?? ''); return new Response(null, { status: 204 }); }
  try { await insert('events', row); } catch (e) { console.error('track insert failed', e); }
  return new Response(null, { status: 204 });
};
