/** Small helpers shared by the admin pages: formatting, redirects, notices, lead vocabulary. */
import { dbReady } from './db';
import { secret } from './env';

export const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const fmtDay = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium' }).format(new Date(iso.length === 10 ? `${iso}T12:00:00+04:00` : iso));

export const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

export const num = (n: number) => new Intl.NumberFormat('en-GB').format(n);
export const aed = (n: number) => `AED ${num(Math.round(n))}`;

const regions = new Intl.DisplayNames(['en'], { type: 'region' });
/** "AE" -> "United Arab Emirates"; unknown codes pass through, blank = "Unknown". */
export const countryName = (code?: string | null) => {
  if (!code) return 'Unknown';
  try { return regions.of(code.toUpperCase()) ?? code; } catch { return code; }
};

/** "AS8966 Emirates Telecommunications" -> "Emirates Telecommunications" */
export const orgName = (org: string) => org.replace(/^AS\d+\s*/, '');

export const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Redirect for admin pages: like every other /admin response it must never be cached (rendered pages get the header from layouts/Admin.astro). */
export const go = (Astro: { redirect: (to: string, status?: any) => Response }, to: string) => {
  const res = Astro.redirect(to, 303); // 303: a POST is answered with a GET of the next page
  res.headers.set('cache-control', 'no-store');
  return res;
};

/** Banner text for the admin pages when Supabase is unconfigured, the schema is missing/out of date, or a query failed. Empty when all is well. */
export const dbNotice = (e?: unknown) =>
  !dbReady() ? 'Database not connected — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the hosting environment variables, then redeploy.'
  : !e ? ''
  : /PGRST20[25]|42P01|42703|42883|PGRST202/.test(String(e)) ? 'Database tables, views or functions are missing or out of date — run supabase/schema.sql in the Supabase SQL editor (safe to re-run).'
  : `Database error: ${String(e).slice(0, 300)}`;

/** Strip PostgREST operator characters from free-text search (callers still URL-encode the result). */
export const safeQ = (q: string) => q.replace(/[,()*:%\\."]/g, ' ').trim().slice(0, 60);

export const waHref = (phone: string, name?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello${name ? ` ${name}` : ''}, this is AlyTech Scientific following up on your enquiry.`)}`;

/** PostHog session-replay link for a lead or WhatsApp click (needs POSTHOG_PROJECT_ID; EU cloud). */
export const replayUrl = (session?: string | null) => {
  const project = secret('POSTHOG_PROJECT_ID');
  return session && project ? `https://eu.posthog.com/project/${encodeURIComponent(project)}/replay/${encodeURIComponent(session)}` : null;
};

/** "google / cpc / spring-launch" from stored utm_* / click ids. */
export const campaignOf = (a?: Record<string, string> | null) =>
  !a ? '' : [a.utm_source ?? (a.gclid || a.gbraid || a.wbraid ? 'google ads' : a.msclkid ? 'bing ads' : a.li_fat_id ? 'linkedin' : ''), a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');

export const modeLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', datasheet: 'Datasheet', price: 'Pricing', quote: 'Quote', specs: 'Specs', interest: 'Interest',
};

// ---------- pipeline vocabulary ----------
export const STAGES = ['new', 'contacted', 'quoted', 'won', 'lost'] as const;
export type Stage = (typeof STAGES)[number];
export const stageLabel: Record<string, string> = { new: 'New', contacted: 'Contacted', quoted: 'Quoted', won: 'Won', lost: 'Lost' };
export const isStage = (s: unknown): s is Stage => (STAGES as readonly string[]).includes(s as string);

/** Spreadsheet-safe CSV cell: quote everything, neutralise formula injection (= + - @ and the tab/CR variants Excel also treats as formula starts). */
export const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};
