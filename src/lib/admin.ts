import { dbReady } from './db';

export const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/** Redirect for admin pages: like every other /admin response it must never be cached (rendered pages get the header from layouts/Admin.astro). */
export const go = (Astro: { redirect: (to: string) => Response }, to: string) => {
  const res = Astro.redirect(to);
  res.headers.set('cache-control', 'no-store');
  return res;
};

/** Banner text for the admin pages when Supabase is unconfigured, the schema is missing/out of date, or a query failed. Empty when all is well. */
export const dbNotice = (e?: unknown) =>
  !dbReady() ? 'Database not connected — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.'
  : !e ? ''
  : /PGRST20[25]|42P01|42703/.test(String(e)) ? 'Database tables or views are missing or out of date — run supabase/schema.sql in the Supabase SQL editor (safe to re-run).'
  : `Database error: ${String(e).slice(0, 300)}`;

/** Strip PostgREST operator characters from free-text search (callers still URL-encode the result). */
export const safeQ = (q: string) => q.replace(/[,()*:%\\."]/g, ' ').trim().slice(0, 60);

export const waHref = (phone: string, name?: string) =>
  `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello${name ? ` ${name}` : ''}, this is AlyTech Scientific following up on your enquiry.`)}`;

const phProject = import.meta.env.POSTHOG_PROJECT_ID as string | undefined;
/** PostHog session-replay link for a lead or WhatsApp click (needs POSTHOG_PROJECT_ID; EU cloud). */
export const replayUrl = (session?: string | null) =>
  session && phProject ? `https://eu.posthog.com/project/${encodeURIComponent(phProject)}/replay/${encodeURIComponent(session)}` : null;

/** "google / cpc / spring-launch" from stored utm_* / click ids. */
export const campaignOf = (a?: Record<string, string> | null) =>
  !a ? '' : [a.utm_source ?? (a.gclid || a.gbraid || a.wbraid ? 'google ads' : a.msclkid ? 'bing ads' : a.li_fat_id ? 'linkedin' : ''), a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');

export const modeLabel: Record<string, string> = {
  whatsapp: 'WhatsApp', datasheet: 'Datasheet', price: 'Pricing', quote: 'Quote', specs: 'Specs', interest: 'Interest',
};
