import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth';
import { dbReady, select } from '../../lib/db';
import { dbNotice } from '../../lib/admin';
import { ATTR_KEYS } from '../../lib/visitor';
export const prerender = false;

const cols = ['created_at', 'status', 'mode', 'name', 'company', 'email', 'phone', 'country', 'product', 'brand', 'category', 'message', 'marketing_consent', 'ip_org', 'geo_city', 'geo_country', 'lang', 'path', 'landing_page', 'referrer', 'handled', 'notes'];
const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything; neutralise spreadsheet formula injection (= + - @ and the tab/CR variants Excel also treats as formula starts).
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

const PAGE = 1000; // PostgREST (Supabase) returns at most 1000 rows per request, whatever `limit` says
const MAX_PAGES = 50; // ponytail: 50k leads is far beyond this site; raise (or stream) if it ever gets close

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await isAdmin(cookies))) return new Response('Unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
  if (!dbReady()) return new Response(dbNotice(), { status: 503, headers: { 'cache-control': 'no-store' } });
  const rows: any[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      // id breaks created_at ties so rows never repeat or vanish between pages
      const batch = await select('leads', `select=${cols.join(',')},attribution&order=created_at.desc,id.desc&limit=${PAGE}&offset=${page * PAGE}`);
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
  } catch (e) {
    console.error('lead export failed', e);
    return new Response(dbNotice(e), { status: 502, headers: { 'cache-control': 'no-store' } });
  }
  const csv = '﻿' + [[...cols, ...ATTR_KEYS].join(','), ...rows.map((r) => [...cols.map((c) => r[c]), ...ATTR_KEYS.map((k) => r.attribution?.[k])].map(cell).join(','))].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alytech-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
