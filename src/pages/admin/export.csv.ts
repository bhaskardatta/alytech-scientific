import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth';
import { select } from '../../lib/db';
export const prerender = false;

const cols = ['created_at', 'status', 'mode', 'name', 'company', 'email', 'phone', 'country', 'product', 'brand', 'category', 'message', 'marketing_consent', 'ip_org', 'geo_city', 'geo_country', 'lang', 'path', 'referrer', 'handled', 'notes'];
const cell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  // Quote everything; neutralise spreadsheet formula injection.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export const GET: APIRoute = async ({ cookies }) => {
  if (!(await isAdmin(cookies))) return new Response('Unauthorized', { status: 401 });
  const rows = await select('leads', `select=${cols.join(',')}&order=created_at.desc&limit=10000`);
  const csv = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="alytech-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
