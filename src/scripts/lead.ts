/**
 * Lead capture + first-party visitor tracking.
 * Sends to our own /api endpoints (admin panel reads the same DB). Nothing here identifies a person
 * until they type their details; the anonymous visitor id only links their page history to that lead.
 * Visitors who haven't accepted cookies are only counted anonymously (page views, no ids, nothing stored in the browser).
 */
import { capture, phSession } from './analytics';
import { ltr } from '../lib/bidi';

type Mode = 'whatsapp' | 'datasheet' | 'price' | 'quote' | 'specs' | 'interest';
interface Ctx { mode: Mode; product?: string; brand?: string; category?: string }

const I = JSON.parse(document.getElementById('lead-i18n')?.textContent || '{}');

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
};
const consented = () => store.get('aly-consent') === 'all';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

// Visitor id persists only with consent; otherwise it lives for this tab session.
export const visitorId = (() => {
  let v = consented() ? store.get('aly-vid') : sessionStorage.getItem('aly-vid');
  if (!v) { v = uid(); consented() ? store.set('aly-vid', v) : sessionStorage.setItem('aly-vid', v); }
  return v;
})();
const sessionId = sessionStorage.getItem('aly-sid') || (sessionStorage.setItem('aly-sid', uid()), sessionStorage.getItem('aly-sid')!);

// Campaign attribution (ads ROI). First touch in the tab session wins; sessionStorage only, so nothing persists without consent.
// Keep in sync with ATTR_KEYS in lib/visitor.ts (the API drops anything else).
const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'li_fat_id'];
const touch = (() => {
  try {
    const saved = sessionStorage.getItem('aly-touch');
    if (saved) return JSON.parse(saved) as { attribution: Record<string, string>; landing: string };
    const params = new URLSearchParams(location.search);
    const attribution = Object.fromEntries(ATTR_KEYS.flatMap((k) => (params.get(k) ? [[k, params.get(k)!.slice(0, 200)]] : [])));
    if (!Object.keys(attribution).length) return {};
    const t = { attribution, landing: location.pathname };
    sessionStorage.setItem('aly-touch', JSON.stringify(t));
    return t;
  } catch { return {}; }
})();

/** `anon` drops the visitor/session ids (used for requests a visitor makes before accepting cookies). */
const send = (url: string, body: object, anon = false) => {
  const data = JSON.stringify({ ...body, ...(!anon && { visitorId, sessionId }), lang: I.lang, path: location.pathname, ts: Date.now() });
  if (navigator.sendBeacon?.(url, new Blob([data], { type: 'application/json' }))) return;
  fetch(url, { method: 'POST', body: data, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
};
export const track = (type: string, data: Record<string, unknown> = {}) => {
  if (!consented()) return;
  send('/api/track/', { type, ...data });
  capture(type, data);
};

// ---------- WhatsApp: straight to the chat ----------
// No form in the way. The prefilled message carries the product and a short reference; the same reference is logged
// with the page, campaign and session, so the engineer can look up what the visitor was viewing (admin → Visitors).
let toastTimer: number | undefined;
/** Brief polite status (the toast is a live region in LeadModal) so the click visibly does something while the new tab opens. */
function toast(text: string) {
  const el = document.querySelector<HTMLElement>('[data-lead-toast]');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = text;
  el.classList.add('is-on');
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-on');
    toastTimer = window.setTimeout(() => (el.textContent = ''), 250); // empty again once faded, so it isn't read as stray text
  }, 3000);
}
function openWhatsApp(c: Ctx) {
  const ref = uid().replace(/-/g, '').slice(0, 5).toUpperCase();
  const what = c.product || c.category || c.brand || '';
  window.open(`https://wa.me/${I.wa}?text=${encodeURIComponent(`${I.greeting} ${what || I.general}.\n(Ref ${ref})`)}`, '_blank', 'noopener');
  toast(I.waOpening);
  send('/api/track/', { type: 'whatsapp', ref, product: c.product, brand: c.brand, category: c.category, ...touch, ph: phSession() }, !consented());
  capture('whatsapp_click', { product: what || undefined });
}

// ---------- Modal ----------
const dialog = document.getElementById('lead-dialog') as HTMLDialogElement | null;
const form = dialog?.querySelector<HTMLFormElement>('[data-lead-form]');
let ctx: Ctx = { mode: 'quote' };
let leadKey = uid(); // one per opening: partial saves and the final submit upsert onto the same row
let partialTimer: number | undefined;
let autoMsg = ''; // the message we pre-filled last time: the next opening replaces it only while the visitor hasn't edited it

const q = <T extends Element>(s: string) => dialog!.querySelector<T>(s)!;
const field = (n: string) => form!.elements.namedItem(n) as HTMLInputElement;
const fieldsOf = () => Object.fromEntries(new FormData(form!)) as Record<string, string>;
const subject = () => ctx.product || ctx.category || ctx.brand || '';

// A group's error: the text under it plus aria-invalid on its inputs (the red border and ring come from that attribute). No text clears both.
const GROUPS = { name: ['name'], contact: ['phone', 'email'] } as const;
const setErr = (key: keyof typeof GROUPS, msg = '') => {
  const p = q<HTMLElement>(`[data-err="${key}"]`);
  p.textContent = msg;
  p.classList.toggle('hidden', !msg);
  for (const n of GROUPS[key]) msg ? field(n).setAttribute('aria-invalid', 'true') : field(n).removeAttribute('aria-invalid');
};
/** What the visitor reads when the send fails, by HTTP status (0 = offline). */
const failText = (status: number) =>
  ({ 429: I.errTooMany, 400: I.errCheck, 422: I.errCheck, 403: I.errExpired } as Record<number, string>)[status] ?? I.errSend;

export function openLead(next: Ctx) {
  // ponytail: until the real number replaces the placeholder (Settings), WhatsApp buttons fall back to the request form.
  if (next.mode === 'whatsapp' && I.waReady) return openWhatsApp(next);
  if (!dialog || !form) return;
  ctx = next;
  leadKey = uid();
  q('[data-lead-eyebrow] span').textContent = subject() || 'AlyTech Scientific';
  q('[data-lead-title]').textContent = I.titles[ctx.mode] ?? I.titles.quote;
  q('[data-lead-sub]').textContent = I.subDefault;
  q('[data-lead-label]').textContent = I.submitDefault;
  for (const k of ['mode', 'product', 'brand', 'category'] as const) field(k).value = (ctx as any)[k] || '';

  // Returning visitors: prefill what they gave us before.
  const saved = JSON.parse(store.get('aly-contact') || '{}');
  for (const k of ['name', 'email', 'phone', 'company', 'country']) {
    const el = field(k);
    if (!el || !saved[k]) continue;
    // A <select> always has a value, so it takes the saved country only if that option exists (the lists differ by language).
    if (el instanceof HTMLSelectElement) { if ([...el.options].some((o) => o.value === saved[k])) el.value = saved[k]; }
    else if (!el.value) el.value = saved[k];
  }
  const msg = field('message');
  const auto = subject() ? `${I.greeting} ${subject()}.` : '';
  if (!msg.value || msg.value === autoMsg) msg.value = auto;
  autoMsg = auto;

  // Fresh state: nothing left over from the last opening
  setErr('name'); setErr('contact');
  q('[data-lead-error]').classList.add('hidden');
  form.removeAttribute('aria-busy');
  q<HTMLButtonElement>('[data-lead-submit]').disabled = false;
  q('[data-lead-form-wrap]').classList.remove('hidden');
  q('[data-lead-done]').classList.add('hidden');
  dialog.showModal();
  dialog.scrollTop = 0;
  field('name').focus();
  track('lead_open', { mode: ctx.mode, product: ctx.product, brand: ctx.brand, category: ctx.category });
}

if (dialog && form) {
  form.addEventListener('input', (e) => {
    // Editing a field clears its own error straight away (it's re-checked on submit)
    const n = (e.target as HTMLInputElement).name;
    if (n === 'name') setErr('name');
    else if (n === 'email' || n === 'phone') setErr('contact');

    // Partial capture: whatever they've typed is saved on each field change (disclosed under the form).
    clearTimeout(partialTimer);
    partialTimer = window.setTimeout(() => {
      const f = fieldsOf();
      if (f.name || f.email || f.phone) send('/api/lead/', { ...f, leadKey, partial: true, ...touch });
    }, 900);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    clearTimeout(partialTimer);
    const f = fieldsOf();
    const err = q<HTMLElement>('[data-lead-error]');
    err.classList.add('hidden'); // last attempt's failure goes away the moment they try again

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email || '');
    const phoneOk = (f.phone || '').replace(/\D/g, '').length >= 7;
    const nameBad = !f.name?.trim();
    const contactBad = !emailOk && !phoneOk;
    setErr('name', nameBad ? I.errName : '');
    setErr('contact', contactBad ? I.errContact : '');
    if (nameBad || contactBad) {
      const bad = form.querySelector<HTMLElement>('[aria-invalid="true"]')!;
      bad.focus({ preventScroll: true });
      bad.scrollIntoView({ block: 'center' });
      return;
    }

    store.set('aly-contact', JSON.stringify({ name: f.name, email: f.email, phone: f.phone, company: f.company, country: f.country }));
    const payload = { ...f, leadKey, visitorId, sessionId, lang: I.lang, path: location.pathname, referrer: document.referrer, ts: Date.now(), ...touch, ph: phSession() };
    const post = () => fetch('/api/lead/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });

    const btn = q<HTMLButtonElement>('[data-lead-submit]');
    const label = q<HTMLElement>('[data-lead-label]');
    const prev = label.textContent;
    btn.disabled = true; label.textContent = I.sending; form.setAttribute('aria-busy', 'true');
    let status = 0;
    let specs: { label: string; value: string }[] | null = null;
    try {
      const res = await post();
      status = res.status;
      if (res.ok) specs = (await res.json()).specs ?? null;
    } catch {}
    btn.disabled = false; label.textContent = prev; form.removeAttribute('aria-busy');

    if (status < 200 || status >= 300) {
      // Values stay as typed; the message takes focus so a screen reader announces it and keyboard users land on it
      err.textContent = failText(status); err.classList.remove('hidden');
      err.focus();
      return;
    }
    capture('lead_submitted', { mode: ctx.mode, product: ctx.product, brand: ctx.brand, category: ctx.category }); // no contact details
    const dl = q<HTMLElement>('[data-lead-specs]');
    dl.replaceChildren(...(specs ?? []).map((sp) => {
      const row = document.createElement('div');
      row.className = 'grid gap-1 py-3 sm:grid-cols-[1fr_1.3fr] sm:gap-4';
      const dt = document.createElement('dt'); dt.className = 'text-[14px] text-mute'; dt.textContent = sp.label;
      // Values mix numbers and units: on Arabic pages each Latin/number run is isolated left-to-right so ranges read correctly.
      const dd = document.createElement('dd'); dd.className = 'font-mono text-[13.5px]';
      dd.innerHTML = ltr(sp.value, document.documentElement.lang === 'ar' ? 'ar' : 'en'); // ltr() escapes
      row.append(dt, dd);
      return row;
    }));
    dl.classList.toggle('hidden', !specs?.length);
    q('[data-lead-form-wrap]').classList.add('hidden');
    q('[data-lead-done]').classList.remove('hidden');
    field('message').value = ''; autoMsg = ''; // sent: the next opening starts a fresh message
    dialog.scrollTop = 0;
    q<HTMLElement>('[data-lead-done-title]').focus(); // the focus move is what announces "Request received"
  });
}

// ---------- Page view + engagement ----------
// The utm tags of THIS page's URL (not the saved first touch), so a campaign visit is counted once, on the page it lands on.
const utmNow = (() => {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign'].flatMap((k) => (params.get(k) ? [[k, params.get(k)!.slice(0, 200)]] : [])));
})();
const pageview = (extra: Record<string, unknown> = {}) =>
  track('pageview', { title: document.title, referrer: document.referrer, product: document.body.dataset.product, attribution: utmNow, ...extra });

if (consented()) pageview();
// No consent yet: count the view anonymously (no ids, no storage). The server keeps only path, referrer host, country, device class, language
// and campaign tags, and never looks the IP up. This is what makes the traffic totals complete; see the privacy policy.
else send('/api/track/', { type: 'pageview', anon: true, referrer: document.referrer, product: document.body.dataset.product, attribution: utmNow }, true);

addEventListener('aly-consent', (e) => {
  if ((e as CustomEvent).detail !== 'all') return;
  store.set('aly-vid', visitorId); // promote the session id so history survives the visit
  pageview({ dup: true }); // this page was just counted anonymously: keep the identified copy for the visitor's journey, but out of the totals
});
