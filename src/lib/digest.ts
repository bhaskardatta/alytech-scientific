/** Emails for the daily job: personal follow-up reminders and the Monday digest. Pure HTML builders; sending happens in the caller. */
import { site } from '../data/site';
import { esc } from './alert';
import { aed, countryName, num, orgName, fmtDay } from './admin';
import { conversion, delta, deltaPoints, isIsp, type Delta, type Kpis, type Overview } from './stats';

const link = (path: string) => `${site.url}${path}`;
const wrap = (title: string, body: string) =>
  `<div style="font:15px/1.5 system-ui,sans-serif;color:#0f172a;max-width:640px"><h2 style="margin:0 0 12px;font-size:20px">${esc(title)}</h2>${body}<p style="margin-top:24px;color:#546174;font-size:13px">AlyTech Scientific admin · <a href="${link('/admin/')}" style="color:#6000cd">Open the dashboard</a></p></div>`;

interface LeadRow { id: string; name: string | null; company: string | null; product: string | null; follow_up: string | null; created_at: string; stage: string }

const list = (title: string, rows: LeadRow[], when: (l: LeadRow) => string) =>
  rows.length === 0 ? '' : `<h3 style="margin:20px 0 6px;font-size:16px">${esc(title)} (${rows.length})</h3><ul style="padding-left:18px;margin:0">${rows
    .slice(0, 25)
    .map((l) => `<li style="margin:4px 0"><a href="${link(`/admin/lead/${l.id}/`)}" style="color:#6000cd;font-weight:600">${esc(l.name ?? 'Unnamed')}</a>${l.company ? `, ${esc(l.company)}` : ''}${l.product ? ` · ${esc(l.product)}` : ''} <span style="color:#546174">· ${esc(when(l))}</span></li>`)
    .join('')}</ul>${rows.length > 25 ? `<p style="color:#546174">…and ${rows.length - 25} more in the dashboard.</p>` : ''}`;

/** Follow-ups due today (or overdue) and new enquiries nobody has touched for over 24 hours. */
export function followUpEmail(name: string, due: LeadRow[], waiting: LeadRow[]) {
  const subject = `Follow-ups today: ${due.length} due${waiting.length ? `, ${waiting.length} waiting for a first reply` : ''}`;
  const html = wrap(`Good morning ${name.split(' ')[0]}`,
    list('Follow-ups due today or overdue', due, (l) => `follow up ${fmtDay(l.follow_up!)}`) +
    list('New enquiries nobody has contacted for over 24 hours', waiting, (l) => `received ${fmtDay(l.created_at)}`) +
    `<p style="margin-top:20px"><a href="${link('/admin/leads/?assignee=me')}" style="color:#6000cd">Open my enquiries</a></p>`);
  return { subject, html };
}

const row = (label: string, value: string, d: Delta) => {
  const color = d.dir === 'up' ? '#0f7b4b' : d.dir === 'down' ? '#b42318' : '#546174';
  const arrow = d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '–';
  return `<tr><td style="padding:6px 12px 6px 0;color:#546174">${esc(label)}</td><td style="padding:6px 12px 6px 0;font-weight:700">${esc(value)}</td><td style="padding:6px 0;color:${color}">${arrow} ${esc(d.text)}</td></tr>`;
};
const top = (title: string, items: { label: string; n: number }[]) =>
  items.length === 0 ? '' : `<h3 style="margin:20px 0 6px;font-size:16px">${esc(title)}</h3><ol style="padding-left:20px;margin:0">${items.map((i) => `<li>${esc(i.label)} <span style="color:#546174">· ${num(i.n)}</span></li>`).join('')}</ol>`;

/** Last 7 full days against the 7 before. */
export function weeklyDigest(cur: Overview, prev: Kpis, range: string) {
  const k = cur.kpis, rate = conversion(k), prevRate = conversion(prev);
  const html = wrap(`Weekly digest · ${range}`,
    `<p style="color:#546174;margin:0 0 8px">Compared with the 7 days before. Page views include visitors who haven’t accepted cookies; “identified visitors” are only those who did.</p>
     <table style="border-collapse:collapse">${[
       row('Page views', num(k.pageviews), delta(k.pageviews, prev.pageviews)),
       row('Identified visitors', num(k.visitors), delta(k.visitors, prev.visitors)),
       row('Enquiries sent', num(k.enquiries), delta(k.enquiries, prev.enquiries)),
       row('WhatsApp chats started', num(k.whatsapp), delta(k.whatsapp, prev.whatsapp)),
       row('Conversion rate', `${(Math.round(rate * 1000) / 10).toLocaleString('en-GB')}%`, deltaPoints(rate, prevRate)),
       row('Deals won', num(k.won_count), delta(k.won_count, prev.won_count)),
       row('Won value', aed(k.won_value), delta(k.won_value, prev.won_value)),
     ].join('')}</table>` +
    top('Most-viewed products', cur.products_viewed.slice(0, 5).map((p) => ({ label: p.k, n: p.n }))) +
    top('Most-asked-about products', cur.products_enquired.slice(0, 5).map((p) => ({ label: p.k, n: p.n }))) +
    top('Top countries', cur.countries.slice(0, 5).map((c) => ({ label: countryName(c.k), n: c.n }))) +
    top('Companies on the site', cur.orgs.filter((o) => !isIsp(o.ip_org)).slice(0, 5).map((o) => ({ label: orgName(o.ip_org), n: o.pageviews }))) +
    `<p style="margin-top:20px"><a href="${link('/admin/')}" style="color:#6000cd;font-weight:600">Open the full dashboard</a></p>`);
  return { subject: `Weekly digest: ${num(k.pageviews)} page views, ${num(k.enquiries)} enquiries, ${num(k.whatsapp)} WhatsApp chats`, html };
}
