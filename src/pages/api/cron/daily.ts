import type { APIRoute } from 'astro';
import { dbReady, select, rpc } from '../../../lib/db';
import { secret } from '../../../lib/env';
import { same } from '../../../lib/auth';
import { sendEmail } from '../../../lib/alert';
import { followUpEmail, weeklyDigest } from '../../../lib/digest';
import { overview } from '../../../lib/stats';
import { dubaiDay, lastDays } from '../../../lib/period';
import { fmtDay } from '../../../lib/admin';

export const prerender = false;

const json = (body: object, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * Daily job (vercel.json crons: 04:00 UTC = 08:00 Dubai). Requires `Authorization: Bearer $CRON_SECRET` (Vercel adds it itself).
 *   keep-alive query -> purge_old_data() -> follow-up emails per person -> Monday digest to owners.
 * Each part runs on its own: a failure in one is reported, never stops the others. Emails are skipped silently when Resend isn't configured.
 * ?dry=1 reports what would happen without purging or sending. ?digest=1 sends the weekly digest on any weekday (testing).
 */
export const GET: APIRoute = async ({ request, url }) => {
  const key = secret('CRON_SECRET');
  if (!key || !(await same(request.headers.get('authorization') ?? '', `Bearer ${key}`))) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!dbReady()) return json({ ok: false, error: 'database not configured' }, 503);

  const dry = url.searchParams.get('dry') === '1';
  const now = new Date();
  const out: Record<string, unknown> = { ok: true, dry, at: now.toISOString() };
  const errors: string[] = [];
  const attempt = async (name: string, fn: () => Promise<unknown>) => {
    try { out[name] = await fn(); } catch (e) { errors.push(`${name}: ${String(e).slice(0, 200)}`); out[name] = { failed: true }; console.error(`cron ${name} failed`, e); }
  };

  // (a) the free Supabase project pauses after a week without traffic: any query counts
  await attempt('keepAlive', async () => { await select('admin_users', 'select=id&limit=1'); return { ok: true }; });

  // (b) retention
  await attempt('purge', async () => { if (!dry) await rpc('purge_old_data'); return { ran: !dry }; });

  // (c) personal follow-up reminders
  await attempt('followUps', async () => {
    const today = dubaiDay(now);
    const cols = 'select=id,name,company,product,stage,follow_up,assigned_to,created_at&spam=eq.false&status=eq.submitted';
    const [users, due, waiting] = await Promise.all([
      select('admin_users', 'select=id,email,name,role&active=is.true'),
      select('leads', `${cols}&follow_up=lte.${today}&stage=not.in.(won,lost)&order=follow_up.asc&limit=300`),
      select('leads', `${cols}&stage=eq.new&created_at=lt.${new Date(now.getTime() - 864e5).toISOString()}&created_at=gt.${new Date(now.getTime() - 30 * 864e5).toISOString()}&order=created_at.asc&limit=300`),
    ]);
    const owners = users.filter((u) => u.role === 'owner');
    const byId = new Map(users.map((u) => [u.id, u]));
    const plan = new Map<string, { user: any; due: any[]; waiting: any[] }>();
    const give = (lead: any, kind: 'due' | 'waiting') => {
      const assignee = lead.assigned_to && byId.get(lead.assigned_to);
      for (const u of assignee ? [assignee] : owners) {
        if (!plan.has(u.id)) plan.set(u.id, { user: u, due: [], waiting: [] });
        plan.get(u.id)![kind].push(lead);
      }
    };
    due.forEach((l) => give(l, 'due'));
    waiting.forEach((l) => give(l, 'waiting'));
    let sent = 0;
    for (const { user, due: d, waiting: w } of plan.values()) {
      const mail = followUpEmail(user.name, d, w); // built even in a dry run, so a template bug shows up there
      if (!dry && (await sendEmail({ to: [user.email], ...mail }))) sent++;
    }
    return { people: plan.size, due: due.length, waiting: waiting.length, emailsSent: sent };
  });

  // (d) Monday digest for owners (Monday in Dubai: the job runs at 08:00 there)
  const monday = new Date(now.getTime() + 4 * 3600_000).getUTCDay() === 1;
  if (monday || url.searchParams.get('digest') === '1') {
    await attempt('digest', async () => {
      const span = lastDays(7, now);
      const [owners, { cur, prev }] = await Promise.all([select('admin_users', 'select=email&active=is.true&role=eq.owner'), overview(span)]);
      const mail = weeklyDigest(cur, prev, `${fmtDay(span.fromDay)} – ${fmtDay(span.toDay)}`);
      return { owners: owners.length, subject: dry ? mail.subject : undefined, sent: !dry && (await sendEmail({ to: owners.map((o) => o.email), ...mail })) };
    });
  }

  if (errors.length) out.errors = errors;
  return json(out);
};
