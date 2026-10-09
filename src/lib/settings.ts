/**
 * Site settings an owner can change in /admin/settings/. One reader for everything:
 *  - static pages call getSiteSettings() while the site builds (the number, contact email, hours and announcement bar are baked into the HTML,
 *    so "Save & publish" triggers a rebuild through DEPLOY_HOOK_URL);
 *  - server code (lead alert recipients) calls it at runtime; the result is cached for a minute.
 * If the database is unreachable or not set up, the defaults from src/data/site.ts are used and the build still succeeds.
 */
import { site } from '../data/site';
import { dbReady, select, upsert } from './db';
import { secret } from './env';
import { dubaiDay } from './period';

export interface Announcement { enabled: boolean; en: string; ar: string; link: string; ends: string }
export interface Settings { whatsapp: string; contactEmail: string; alertEmails: string[]; hours: { en: string; ar: string }; announcement: Announcement }
export interface Publish { at: string; by: string; state: 'requested' | 'failed' | 'not-configured'; message: string }

export const DEFAULTS: Settings = {
  whatsapp: String(site.whatsapp),
  contactEmail: site.email,
  alertEmails: [], // empty = fall back to LEAD_ALERT_TO
  hours: { en: '', ar: '' },
  announcement: { enabled: false, en: '', ar: '', link: '', ends: '' },
};

export interface SettingRow { key: string; value: any; updated_at: string; updated_by: string | null }

/** Settings table rows -> typed settings, ignoring anything malformed so one bad row can't break a build. */
export function fromRows(rows: SettingRow[]): Settings {
  const v = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const str = (x: unknown, d: string) => (typeof x === 'string' && x.trim() ? x.trim() : d);
  const a = v.announcement ?? {};
  return {
    whatsapp: str(v.whatsapp, DEFAULTS.whatsapp).replace(/\D/g, '') || DEFAULTS.whatsapp,
    contactEmail: str(v.contact_email, DEFAULTS.contactEmail),
    alertEmails: Array.isArray(v.alert_emails) ? v.alert_emails.filter((e: unknown) => typeof e === 'string' && isEmail(e)) : [],
    hours: { en: str(v.office_hours?.en, ''), ar: str(v.office_hours?.ar, '') },
    announcement: { enabled: a.enabled === true, en: str(a.en, ''), ar: str(a.ar, ''), link: str(a.link, ''), ends: str(a.ends, '') },
  };
}

export const readRows = () => select<SettingRow>('settings', 'select=key,value,updated_at,updated_by');

let cache: { at: number; value: Promise<Settings> } | undefined;
const TTL = 60_000;

/** Current settings (cached ~1 minute). `fresh` skips the cache: the settings page itself always shows what is stored. */
export function getSiteSettings(fresh = false): Promise<Settings> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value;
  const value = (async () => {
    if (!dbReady()) return DEFAULTS;
    try { return fromRows(await readRows()); } catch (e) {
      console.warn('settings unavailable, using defaults:', String(e).slice(0, 200)); // build must not fail because the database is down
      return DEFAULTS;
    }
  })();
  cache = { at: Date.now(), value };
  return value;
}

export const dropSettingsCache = () => { cache = undefined; };

/** Is the bar showing right now? Both languages filled in, switched on, and the end date (end of that day in Dubai) not passed. */
export const announcementLive = (a: Announcement, now = new Date()) =>
  a.enabled && Boolean(a.en && a.ar) && (!a.ends || dubaiDay(now) <= a.ends);

/** ISO instant when the bar stops (midnight after the end date, Dubai), or '' when open-ended. Written into the page so a cached page hides it on time. */
export const announcementEnd = (a: Announcement) => (a.ends ? new Date(new Date(`${a.ends}T00:00:00+04:00`).getTime() + 864e5).toISOString() : '');

// ---------- validation ----------
export const isEmail = (s: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/.test(s) && s.length <= 200;

/** International number -> digits only ("+971 50 123 4567" -> "971501234567"). Returns null if it isn't one. */
export function parseWhatsApp(raw: string) {
  const s = raw.trim();
  if (!/^[+\d][\d\s().-]*$/.test(s)) return null;
  let d = s.replace(/\D/g, '');
  if (s.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) return null; // national format (050…): the country code is missing
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function parseEmails(raw: string, max = 10) {
  const list = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  return { list: list.slice(0, max), bad: list.filter((e) => !isEmail(e)), tooMany: list.length > max };
}

/** Link target for the bar: a site path ("/contact/") or an https URL. Anything else is refused (no javascript:, no protocol-relative). */
export function parseLink(raw: string) {
  const s = raw.trim();
  if (!s) return '';
  if (/^\/(?!\/)[^\s]*$/.test(s)) return s;
  try { const u = new URL(s); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : null; } catch { return null; }
}

// ---------- publish ----------
export async function saveRows(rows: { key: string; value: unknown }[], userId: string | null) {
  const now = new Date().toISOString();
  await upsert('settings', rows.map((r) => ({ ...r, updated_by: userId, updated_at: now })), 'key');
  dropSettingsCache();
}

/** Ask the host to rebuild the site (Vercel deploy hook today) so the new values reach the static pages. */
export async function triggerDeploy(by: string): Promise<Publish> {
  const base = { at: new Date().toISOString(), by };
  const hook = secret('DEPLOY_HOOK_URL');
  if (!hook) return { ...base, state: 'not-configured', message: 'DEPLOY_HOOK_URL is not set, so the site was not rebuilt. Redeploy by hand to publish.' };
  try {
    const res = await fetch(hook, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    return res.ok ? { ...base, state: 'requested', message: 'Rebuild requested. The new values go live in about 1–2 minutes.' } : { ...base, state: 'failed', message: `The deploy hook answered HTTP ${res.status}.` };
  } catch (e) {
    return { ...base, state: 'failed', message: `The deploy hook could not be reached (${String(e).slice(0, 120)}).` };
  }
}
