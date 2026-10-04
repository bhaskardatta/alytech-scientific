/** Minimal Supabase PostgREST client (server-only). ponytail: plain fetch, no SDK needed for insert/upsert/select. */
const url = import.meta.env.SUPABASE_URL as string | undefined;
const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const dbReady = () => Boolean(url && key);

async function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  if (!url || !key) throw new Error('Supabase env vars missing');
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.prefer && { prefer: init.prefer }),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export const insert = (table: string, row: object) => rest(table, { method: 'POST', body: JSON.stringify(row), prefer: 'return=minimal' });

export const upsert = (table: string, row: object, onConflict: string) =>
  rest(`${table}?on_conflict=${onConflict}`, { method: 'POST', body: JSON.stringify(row), prefer: 'resolution=merge-duplicates,return=minimal' });

export const update = (table: string, filter: string, patch: object) =>
  rest(`${table}?${filter}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' });

/** `query` is a raw PostgREST query string, e.g. "select=*&order=created_at.desc&limit=50". */
export const select = <T = any>(table: string, query: string) => rest(`${table}?${query}`) as Promise<T[]>;
