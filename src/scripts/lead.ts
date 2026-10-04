/**
 * Lead capture + first-party visitor tracking.
 * Sends to our own /api endpoints (admin panel reads the same DB). Nothing here identifies a person
 * until they type their details; the anonymous visitor id only links their page history to that lead.
 */
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

const send = (url: string, body: object) => {
  const data = JSON.stringify({ ...body, visitorId, sessionId, lang: I.lang, path: location.pathname, ts: Date.now() });
  if (navigator.sendBeacon?.(url, new Blob([data], { type: 'application/json' }))) return;
  fetch(url, { method: 'POST', body: data, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
};
export const track = (type: string, data: object = {}) => { if (consented()) send('/api/track/', { type, ...data }); };

// ---------- Modal ----------
const dialog = document.getElementById('lead-dialog') as HTMLDialogElement | null;
const form = dialog?.querySelector<HTMLFormElement>('[data-lead-form]');
let ctx: Ctx = { mode: 'quote' };
let leadKey = uid(); // one per opening: partial saves and the final submit upsert onto the same row
let partialTimer: number | undefined;

const q = <T extends Element>(s: string) => dialog!.querySelector<T>(s)!;
const fieldsOf = () => Object.fromEntries(new FormData(form!)) as Record<string, string>;
const subject = () => ctx.product || ctx.category || ctx.brand || '';

export function openLead(next: Ctx) {
  if (!dialog || !form) return;
  ctx = next;
  leadKey = uid();
  const wa = ctx.mode === 'whatsapp';
  q('[data-lead-eyebrow] span').textContent = subject() || 'AlyTech Scientific';
  q('[data-lead-title]').textContent = I.titles[ctx.mode] ?? I.titles.quote;
  q('[data-lead-sub]').textContent = wa ? I.subWa : I.subDefault;
  q('[data-lead-submit] span').textContent = wa ? I.submitWa : I.submitDefault;
  q<HTMLElement>('[data-message-row]').hidden = wa;
  for (const k of ['mode', 'product', 'brand', 'category'] as const) (form.elements.namedItem(k) as HTMLInputElement).value = (ctx as any)[k] || '';

  // Returning visitors: prefill what they gave us before.
  const saved = JSON.parse(store.get('aly-contact') || '{}');
  for (const k of ['name', 'email', 'phone', 'company', 'country']) {
    const el = form.elements.namedItem(k) as HTMLInputElement | null;
    if (el && saved[k] && !el.value) el.value = saved[k];
  }
  const msg = form.elements.namedItem('message') as HTMLTextAreaElement;
  if (!msg.value && subject()) msg.value = `${I.greeting} ${subject()}.`;

  q('[data-lead-form-wrap]').classList.remove('hidden');
  q('[data-lead-done]').classList.add('hidden');
  q('[data-lead-error]').classList.add('hidden');
  dialog.showModal();
  (form.elements.namedItem('name') as HTMLInputElement).focus();
  track('lead_open', { mode: ctx.mode, product: ctx.product, brand: ctx.brand, category: ctx.category });
}

if (dialog && form) {
  // Partial capture: whatever they've typed is saved on each field change (disclosed under the form).
  form.addEventListener('input', () => {
    clearTimeout(partialTimer);
    partialTimer = window.setTimeout(() => {
      const f = fieldsOf();
      if (f.name || f.email || f.phone) send('/api/lead/', { ...f, leadKey, partial: true });
    }, 900);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearTimeout(partialTimer);
    const f = fieldsOf();
    const nameErr = q<HTMLElement>('[data-err="name"]');
    const nameEl = form.elements.namedItem('name') as HTMLInputElement;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email || '');
    const phoneOk = (f.phone || '').replace(/\D/g, '').length >= 7;
    const hint = q<HTMLElement>('[data-err-host="contact"]');

    nameEl.setAttribute('aria-invalid', String(!f.name?.trim()));
    nameErr.textContent = I.errName; nameErr.classList.toggle('hidden', !!f.name?.trim());
    const contactBad = !emailOk && !phoneOk;
    for (const k of ['email', 'phone']) (form.elements.namedItem(k) as HTMLInputElement).setAttribute('aria-invalid', String(contactBad));
    hint.classList.toggle('text-danger', contactBad);
    if (contactBad) hint.textContent = I.errContact;
    if (!f.name?.trim() || contactBad) {
      (form.querySelector('[aria-invalid="true"]') as HTMLElement)?.focus();
      return;
    }

    store.set('aly-contact', JSON.stringify({ name: f.name, email: f.email, phone: f.phone, company: f.company, country: f.country }));
    const btn = q<HTMLButtonElement>('[data-lead-submit]');
    const label = btn.querySelector('span')!;
    const prev = label.textContent;
    btn.disabled = true; label.textContent = I.sending;

    const payload = { ...f, leadKey, visitorId, sessionId, lang: I.lang, path: location.pathname, referrer: document.referrer, ts: Date.now() };
    let ok = false;
    let specs: { label: string; value: string }[] | null = null;
    try {
      const res = await fetch('/api/lead/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      ok = res.ok;
      if (ok) specs = (await res.json()).specs ?? null;
    } catch {}
    btn.disabled = false; label.textContent = prev;

    if (ctx.mode === 'whatsapp') {
      // Never block the conversation on our backend: open WhatsApp regardless.
      const text = `${I.greeting} ${subject() || I.general}.\n— ${f.name}${f.company ? `, ${f.company}` : ''}`;
      window.open(`https://wa.me/${I.wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      dialog.close();
      return;
    }
    if (!ok) {
      const err = q<HTMLElement>('[data-lead-error]');
      err.textContent = I.errSend; err.classList.remove('hidden');
      return;
    }
    const dl = q<HTMLElement>('[data-lead-specs]');
    dl.replaceChildren(...(specs ?? []).map((sp) => {
      const row = document.createElement('div');
      row.className = 'grid gap-1 py-3 sm:grid-cols-[1fr_1.3fr] sm:gap-4';
      const dt = document.createElement('dt'); dt.className = 'text-[14px] text-mute'; dt.textContent = sp.label;
      const dd = document.createElement('dd'); dd.className = 'font-mono text-[13.5px]'; dd.textContent = sp.value;
      row.append(dt, dd);
      return row;
    }));
    dl.classList.toggle('hidden', !specs?.length);
    q('[data-lead-form-wrap]').classList.add('hidden');
    q('[data-lead-done]').classList.remove('hidden');
  });
}

// ---------- Page view + engagement ----------
const pageview = () => track('pageview', { title: document.title, referrer: document.referrer, product: document.body.dataset.product });
pageview();
addEventListener('aly-consent', (e) => {
  if ((e as CustomEvent).detail !== 'all') return;
  store.set('aly-vid', visitorId); // promote the session id so history survives the visit
  pageview();
});
