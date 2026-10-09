/** Instant email for each submitted lead via Resend. Resolves true only if the email was accepted (false when not configured or failed). */
const key = import.meta.env.RESEND_API_KEY as string | undefined;
const to = (import.meta.env.LEAD_ALERT_TO as string | undefined)?.split(',').map((s) => s.trim()).filter(Boolean);
const from = (import.meta.env.LEAD_ALERT_FROM as string | undefined) ?? 'AlyTech Website <onboarding@resend.dev>';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function alertNewLead(l: Record<string, any>) {
  if (!key || !to?.length) return false;
  const rows = [
    ['Request', l.mode], ['Product', l.product], ['Name', l.name], ['Company', l.company],
    ['Email', l.email], ['Phone / WhatsApp', l.phone], ['Country', l.country], ['Message', l.message],
    ['Network', l.ip_org], ['Location', [l.geo_city, l.geo_country].filter(Boolean).join(', ')], ['Page', l.path],
    ['Campaign', Object.entries(l.attribution ?? {}).map(([k, v]) => `${k}=${v}`).join(' ')],
  ].filter(([, v]) => v);
  const html = `<table cellpadding="6" style="font:14px system-ui;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#546174">${k}</td><td><b>${esc(v)}</b></td></tr>`)
    .join('')}</table>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from, to,
        subject: `New ${l.mode ?? 'website'} lead: ${l.name}${l.product ? ` — ${l.product}` : ''}`,
        html,
        ...(l.email && { reply_to: l.email }),
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return true;
  } catch (e) {
    console.error('lead alert failed', e); // never throws: the caller decides whether an unsent alert matters
    return false;
  }
}
