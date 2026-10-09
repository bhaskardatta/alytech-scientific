/** Email via Resend: instant alert for each submitted lead, and the generic sender the daily job uses. Nothing here throws. */
import { secret } from './env';
import { getSiteSettings } from './settings';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface Mail { to: string[]; subject: string; html: string; replyTo?: string }

/** Resolves true only if Resend accepted the email. False when RESEND_API_KEY isn't set (silently skipped) or the call failed. */
export async function sendEmail(m: Mail) {
  const key = secret('RESEND_API_KEY');
  if (!key || !m.to.length) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: secret('LEAD_ALERT_FROM') ?? 'AlyTech Website <onboarding@resend.dev>',
        to: m.to, subject: m.subject, html: m.html,
        ...(m.replyTo && { reply_to: m.replyTo }),
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return true;
  } catch (e) {
    console.error('email failed', e); // the caller decides whether an unsent email matters
    return false;
  }
}

/** Who gets the instant lead alert: the addresses an owner saved in Settings, else LEAD_ALERT_TO. */
export async function alertRecipients() {
  const saved = (await getSiteSettings()).alertEmails;
  return saved.length ? saved : (secret('LEAD_ALERT_TO')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []);
}

export async function alertNewLead(l: Record<string, any>) {
  const to = await alertRecipients();
  if (!to.length) return false;
  const rows = [
    ['Request', l.mode], ['Product', l.product], ['Name', l.name], ['Company', l.company],
    ['Email', l.email], ['Phone / WhatsApp', l.phone], ['Country', l.country], ['Message', l.message],
    ['Network', l.ip_org], ['Location', [l.geo_city, l.geo_country].filter(Boolean).join(', ')], ['Page', l.path],
    ['Campaign', Object.entries(l.attribution ?? {}).map(([k, v]) => `${k}=${v}`).join(' ')],
  ].filter(([, v]) => v);
  const html = `<table cellpadding="6" style="font:14px system-ui;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#546174">${k}</td><td><b>${esc(v)}</b></td></tr>`)
    .join('')}</table>`;
  return sendEmail({ to, subject: `New ${l.mode ?? 'website'} lead: ${l.name}${l.product ? ` — ${l.product}` : ''}`, html, replyTo: l.email || undefined });
}
