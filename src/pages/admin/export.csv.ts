import type { APIRoute } from 'astro';
import { dbReady, select } from '../../lib/db';
import { dbNotice, csvCell } from '../../lib/admin';
import { ATTR_KEYS } from '../../lib/visitor';
import { parseLeadFilters, leadQuery, SORTS } from '../../lib/leads';
import { assignableUsers } from '../../lib/users';
import { audit } from '../../lib/audit';
export const prerender = false;

const cols = [
  'created_at', 'status', 'stage', 'value_aed', 'assigned', 'follow_up', 'lost_reason', 'spam', 'tags', 'won_at', 'wa_ref',
  'mode', 'name', 'company', 'email', 'phone', 'country', 'product', 'brand', 'category', 'message', 'marketing_consent', 'ip_org', 'geo_city', 'geo_country',
  'lang', 'path', 'landing_page', 'referrer', 'handled', 'notes',
];
const dbCols = cols.filter((c) => c !== 'assigned');

const PAGE = 1000; // PostgREST (Supabase) returns at most 1000 rows per request, whatever `limit` says
const MAX_PAGES = 50; // ponytail: 50k leads is far beyond this site; raise (or stream) if it ever gets close

/** Same filters as the Enquiries list (the query string is passed through), so the file matches what was on screen. Signed-in + read access is enforced in src/middleware.ts. */
export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user!;
  if (!dbReady()) return new Response(dbNotice(), { status: 503, headers: { 'cache-control': 'no-store' } });
  const f = parseLeadFilters(url.searchParams);
  const where = leadQuery(f, user.id);
  const rows: any[] = [];
  let staff: any[] = [];
  try {
    staff = await assignableUsers();
    for (let page = 0; page < MAX_PAGES; page++) {
      // the sort's own order plus id breaks ties so rows never repeat or vanish between pages
      const batch = await select('leads', `select=${dbCols.join(',')},assigned_to,attribution${where ? `&${where}` : ''}&order=${SORTS[f.sort].order},id.desc&limit=${PAGE}&offset=${page * PAGE}`);
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
  } catch (e) {
    console.error('lead export failed', e);
    return new Response(dbNotice(e), { status: 502, headers: { 'cache-control': 'no-store' } });
  }
  await audit(user, 'leads.export', null, { rows: rows.length, filters: url.search.slice(1, 300) });
  const names = new Map(staff.map((u) => [u.id, u.name]));
  const value = (r: any, c: string) => (c === 'assigned' ? (r.assigned_to ? (names.get(r.assigned_to) ?? 'Former user') : '') : c === 'tags' ? (r.tags ?? []).join('; ') : r[c]);
  const csv = '﻿' + [[...cols, ...ATTR_KEYS].join(','), ...rows.map((r) => [...cols.map((c) => value(r, c)), ...ATTR_KEYS.map((k) => r.attribution?.[k])].map(csvCell).join(','))].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alytech-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
