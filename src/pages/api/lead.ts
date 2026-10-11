import type { APIRoute } from 'astro';
import { dbReady, upsert, count } from '../../lib/db';
import { requestInfo, ipOrg, clean, cleanAttribution } from '../../lib/visitor';
import { alertNewLead } from '../../lib/alert';
import { originOk, limited } from '../../lib/guard';
import { specsFor } from '../../data/equipment';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODES = new Set(['whatsapp', 'datasheet', 'price', 'quote', 'specs', 'interest']);
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!originOk(request)) return json({ ok: false }, 403);
  const raw = await request.text();
  if (raw.length > 12_000) return json({ ok: false }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  if (typeof b.leadKey !== 'string' || !UUID.test(b.leadKey)) return json({ ok: false }, 400);

  if (clean(b.hp_url)) return json({ ok: true }); // honeypot: only bots fill the hidden field. Pretend success, store nothing.

  const partial = b.partial === true;
  const meta = requestInfo(request, clientAddress);
  // Rejected before the IPinfo lookup below, so abuse costs us nothing external.
  if (limited(`${partial ? 'partial' : 'lead'}:${meta.ip}`, partial ? 60 : 5)) return json({ ok: false, error: 'rate' }, 429);
  const email = clean(b.email, 200);
  const phone = clean(b.phone, 40);
  const name = clean(b.name, 120);
  if (!partial && (!name || (!(email && EMAIL.test(email)) && (phone ?? '').replace(/\D/g, '').length < 7))) {
    return json({ ok: false, error: 'invalid' }, 422);
  }

  const attribution = cleanAttribution(b.attribution);
  const row = {
    lead_key: b.leadKey,
    // Omitted on partial saves so a late keystroke never downgrades a submitted lead.
    ...(!partial && { status: 'submitted' }),
    mode: MODES.has(b.mode as string) ? b.mode : null,
    name, email, phone,
    company: clean(b.company, 160),
    country: clean(b.country, 80),
    message: clean(b.message, 4000),
    product: clean(b.product, 200),
    brand: clean(b.brand, 120),
    category: clean(b.category, 160),
    marketing_consent: b.marketing === 'yes',
    lang: b.lang === 'ar' ? 'ar' : 'en',
    path: clean(b.path, 300),
    referrer: clean(b.referrer, 500),
    // Only sent when present, so a lead without a campaign never touches the (newer) columns.
    ...(attribution && { attribution, landing_page: clean(b.landing, 300) }),
    ...(clean(b.ph, 100) && { ph_session: clean(b.ph, 100) }), // PostHog session, for the replay link in admin
    visitor_id: clean(b.visitorId, 64),
    session_id: clean(b.sessionId, 64),
    ...meta,
    ip_org: await ipOrg(meta.ip),
    updated_at: new Date().toISOString(),
  };

  // The reward for a "specs" inquiry: gated typical ranges, never present in page HTML.
  const specs = !partial && row.mode === 'specs' && row.category ? specsFor(row.category, row.lang) : null;

  let stored = false;
  if (dbReady()) {
    try { await upsert('leads', row, 'lead_key'); stored = true; } catch (e) {
      console.error('lead upsert failed', e);
      if (partial) return json({ ok: false }, 500);
    }
  }
  if (partial) {
    if (!dbReady() && import.meta.env.DEV) console.log('[lead:partial]', row); // nothing to save into: drop it, the visitor is still typing
    return json({ ok: true, stored });
  }

  // One IP flooding forms still gets stored, but stops generating emails.
  let flood = false;
  if (stored && meta.ip) flood = (await count('leads', `status=eq.submitted&ip=eq.${encodeURIComponent(meta.ip)}&created_at=gte.${new Date(Date.now() - 36e5).toISOString()}`).catch(() => 0)) > 8;
  const emailed = !flood && (await alertNewLead(row));
  if (!stored && !emailed) {
    // Never claim success for a lead that exists nowhere. Only dev without Supabase keeps the log-and-ok flow, for testing the UI.
    if (dbReady() || import.meta.env.PROD) {
      console.error('LEAD NOT STORED', JSON.stringify(row));
      return json({ ok: false, error: 'unavailable' }, 503);
    }
    console.log('[lead]', row);
  }
  return json({ ok: true, stored, specs });
};
