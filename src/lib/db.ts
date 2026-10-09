/** Minimal Supabase PostgREST client (server-only). ponytail: plain fetch, no SDK needed for insert/upsert/select/rpc. */
import { secret } from './env';

const cfg = () => ({ url: secret('SUPABASE_URL'), key: secret('SUPABASE_SERVICE_ROLE_KEY') });
export const dbReady = () => { const { url, key } = cfg(); return Boolean(url && key); };

type Init = RequestInit & { prefer?: string };

async function call(path: string, init: Init = {}) {
  const { url, key } = cfg();
  if (!url || !key) throw new Error('Supabase env vars missing');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    signal: AbortSignal.timeout(15_000), // a hung database must not hang a build or a function until the platform kills it
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.prefer && { prefer: init.prefer }),
    },
  });
  if (!res.ok) throw Object.assign(new Error(`Supabase ${res.status}: ${await res.text()}`), { status: res.status, range: res.headers.get('content-range') });
  return res;
}

const parse = (text: string) => (text ? JSON.parse(text) : null);
// return=minimal answers 201 (inserts) or 204 (updates) with an empty body, which res.json() would throw on.
const rest = async (path: string, init: Init = {}) => parse(await (await call(path, init)).text());

/** Insert one row. With `returning` the stored row (with its generated id) comes back. */
export async function insert(table: string, row: object, returning = false) {
  const out = await rest(table, { method: 'POST', body: JSON.stringify(row), prefer: returning ? 'return=representation' : 'return=minimal' });
  return returning ? (out?.[0] ?? null) : null;
}

export const upsert = (table: string, row: object, onConflict: string) =>
  rest(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: JSON.stringify(row), prefer: 'resolution=merge-duplicates,return=minimal' });

export const update = (table: string, filter: string, patch: object) =>
  rest(`${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' });

export const remove = (table: string, filter: string) => rest(`${table}?${filter}`, { method: 'DELETE', prefer: 'return=minimal' });

/** `query` is a raw PostgREST query string, e.g. "select=*&order=created_at.desc&limit=50". */
export const select = <T = any>(table: string, query: string) => rest(`${table}?${query}`) as Promise<T[]>;

/** Rows plus the exact total matching the filter (ignores limit/offset), in one request. */
export async function page<T = any>(table: string, query: string) {
  try {
    const res = await call(`${table}?${query}`, { prefer: 'count=exact' });
    return { rows: (parse(await res.text()) ?? []) as T[], total: Number(res.headers.get('content-range')?.split('/')[1]) || 0 };
  } catch (e: any) {
    if (e.status === 416) return { rows: [] as T[], total: Number(e.range?.split('/')[1]) || 0 }; // a page number past the end
    throw e;
  }
}

/** Exact row count for a PostgREST filter (e.g. "status=eq.submitted&ip=eq.1.2.3.4") without fetching rows or hitting the 1000-row cap. */
export const count = async (table: string, filter: string) =>
  Number((await call(`${table}?select=id&${filter}`, { method: 'HEAD', prefer: 'count=exact' })).headers.get('content-range')?.split('/')[1]) || 0;

/** Call a SQL function (supabase/schema.sql) with named arguments. */
export const rpc = <T = any>(fn: string, args: object = {}) => rest(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }) as Promise<T>;

/** Value for a PostgREST filter: `eq.${v(x)}`. */
export const v = (x: string | number) => encodeURIComponent(String(x));
