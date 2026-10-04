import type { APIRoute } from 'astro';
import { dbReady, upsert } from '../../lib/db';
import { requestInfo, ipOrg, clean } from '../../lib/visitor';
import { alertNewLead } from '../../lib/alert';
import { specsFor } from '../../data/equipment';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MODES = new Set(['whatsapp', 'datasheet', 'price', 'quote', 'specs', 'interest']);
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const raw = await request.text();
  if (raw.length > 12_000) return json({ ok: false }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  if (typeof b.leadKey !== 'string' || !UUID.test(b.leadKey)) return json({ ok: false }, 400);

  const partial = b.partial === true;
  const email = clean(b.email, 200);
  const phone = clean(b.phone, 40);
  const name = clean(b.name, 120);
  if (!partial && (!name || (!(email && EMAIL.test(email)) && (phone ?? '').replace(/\D/g, '').length < 7))) {
    return json({ ok: false, error: 'invalid' }, 422);
  }

  const meta = requestInfo(request, clientAddress);
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
    visitor_id: clean(b.visitorId, 64),
    session_id: clean(b.sessionId, 64),
    ...meta,
    ip_org: await ipOrg(meta.ip),
    updated_at: new Date().toISOString(),
  };

  // The reward for a "specs" inquiry: gated typical ranges, never present in page HTML.
  const specs = !partial && row.mode === 'specs' && row.category ? specsFor(row.category) : null;

  if (!dbReady()) {
    // ponytail: local dev without Supabase — log instead of failing so the UI flow can be tested.
    console.log(`[lead${partial ? ':partial' : ''}]`, row);
    return json({ ok: true, stored: false, specs });
  }
  try {
    await upsert('leads', row, 'lead_key');
    if (!partial) await alertNewLead(row);
    return json({ ok: true, specs });
  } catch (e) {
    console.error('lead upsert failed', e);
    return json({ ok: false }, 500);
  }
};
