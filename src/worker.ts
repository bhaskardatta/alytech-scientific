/**
 * Cloudflare Worker entry (wrangler.jsonc "main"; the Vercel build never loads this file). Wraps Astro's handler with what Vercel gives us
 * in vercel.json, plus the admin host:
 *   - /ingest/*      same-origin proxy to PostHog EU (vercel.json rewrites)
 *   - apex host      alytechme.com -> www.alytechme.com (the zone-level Redirect Rule is the real fix; this covers requests that reach the Worker)
 *   - admin host     ADMIN_HOST (admin.alytechme.com) serves the admin panel without the /admin prefix; /admin* elsewhere redirects there
 *   - headers        the security headers of vercel.json on every Worker-generated response; noindex on *.workers.dev
 *   - scheduled      the daily job, by calling /api/cron/daily/ in-process (the only scheduler: Vercel has no cron, so it never runs twice)
 * Static files never reach this code unless wrangler.jsonc run_worker_first lists them; their headers come from dist/client/_headers.
 */
import { handle } from '@astrojs/cloudflare/handler';
import vercel from '../vercel.json';
import { site } from './data/site';

interface Env {
  ASSETS: { fetch(request: Request | string): Promise<Response> };
  ADMIN_HOST?: string;
  CRON_SECRET?: string;
}
interface Ctx { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
declare class HTMLRewriter { on(selector: string, handlers: object): HTMLRewriter; transform(res: Response): Response }

const NOINDEX = 'noindex, nofollow';
const WWW = new URL(site.url).hostname; // www.alytechme.com
const APEX = WWW.replace(/^www\./, '');

// vercel.json is the one place the security headers are written: the first block (every path, no host condition).
const SECURITY = (vercel.headers as { source: string; has?: unknown; headers: { key: string; value: string }[] }[])
  .find((h) => h.source === '/(.*)' && !h.has)!.headers.map(({ key, value }) => [key, value] as const);

const POSTHOG_API = 'eu.i.posthog.com';
const POSTHOG_ASSETS = 'eu-assets.i.posthog.com';

// ---------- helpers ----------
/** Same body, editable headers (responses from fetch() and the ASSETS binding are immutable). */
const editable = (res: Response) => new Response(res.body, res);

const redirect = (to: string, req: Request) => Response.redirect(to, req.method === 'GET' || req.method === 'HEAD' ? 301 : 308);

/** "/admin/leads/?x=1" -> "/leads/?x=1"; "/admin/" -> "/". Anything not under /admin is returned as it is. */
const unprefix = (v: string) => {
  const rest = v.replace(/^\/admin(?=[/?#]|$)/, '');
  return rest === v ? v : rest.startsWith('/') ? rest : `/${rest}`;
};

/**
 * Security headers on a response that did not get them from the asset store; noindex on workers.dev.
 * Astro already sends a Content-Security-Policy header on pages (script/style hashes). The vercel.json one (frame-ancestors ...) is a second
 * policy next to it, exactly as on Vercel, so it is appended rather than skipped.
 */
function finish(res: Response, host: string) {
  const missing = SECURITY.filter(([k]) => (k.toLowerCase() === 'content-security-policy' ? !/frame-ancestors/i.test(res.headers.get(k) ?? '') : !res.headers.has(k)));
  const noindex = host.endsWith('.workers.dev') && !res.headers.has('x-robots-tag');
  if (!missing.length && !noindex) return res;
  const out = editable(res);
  for (const [k, v] of missing) out.headers.append(k, v);
  if (noindex) out.headers.set('x-robots-tag', NOINDEX);
  return out;
}

// ---------- PostHog proxy ----------
async function ingest(request: Request, url: URL) {
  const path = url.pathname.slice('/ingest'.length); // "/static/array.js", "/e/", "/array/<key>/config.js" ...
  const host = /^\/(static|array)\//.test(path) ? POSTHOG_ASSETS : POSTHOG_API;
  const headers = new Headers(request.headers);
  headers.delete('cookie'); // our cookies (admin session ...) never go to a third party
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) headers.set('x-forwarded-for', ip); // PostHog GeoIP looks at the visitor, not at Cloudflare
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;
  return fetch(new Request(`https://${host}${path}${url.search}`, { method: request.method, headers, body, redirect: 'manual' }));
}

// ---------- admin host ----------
// Real files and system routes keep their normal URL on the admin host; everything else is an admin page ("/x" -> "/admin/x").
const NOT_ADMIN = /^\/(?:_|api\/|ingest\/|brand\/|og\/|images\/|favicon|apple-touch-icon|icon-|site\.webmanifest$|\.well-known\/)/;
const URL_ATTRS = ['href', 'action', 'formaction', 'src'];

/** Pages are written with /admin/... links; on the admin host the browser must see the clean URL. */
const stripAdminLinks = {
  element(el: { getAttribute(n: string): string | null; setAttribute(n: string, v: string): void }) {
    for (const a of URL_ATTRS) {
      const v = el.getAttribute(a);
      if (v && unprefix(v) !== v) el.setAttribute(a, unprefix(v));
    }
  },
};

async function adminHost(request: Request, url: URL, env: Env, ctx: Ctx) {
  const path = url.pathname;
  if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': NOINDEX } });
  if (NOT_ADMIN.test(path)) return handle(request, env, ctx);
  // An old /admin/... link or bookmark: send it to the clean URL instead of looking for /admin/admin/...
  if (unprefix(path) !== path) return redirect(url.origin + unprefix(path) + url.search, request);
  // Astro is configured with trailingSlash: 'always'; the browser should not need to type it.
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) return Response.redirect(`${url.origin}${path}/${url.search}`, 308);

  const inner = new URL(url);
  inner.pathname = `/admin${path}`;
  const res = editable(await handle(new Request(inner.href, request), env, ctx));
  res.headers.set('x-robots-tag', NOINDEX);
  const location = res.headers.get('location');
  if (location) res.headers.set('location', location.startsWith(url.origin) ? url.origin + unprefix(location.slice(url.origin.length)) : unprefix(location));
  return /text\/html/i.test(res.headers.get('content-type') ?? '') ? new HTMLRewriter().on(URL_ATTRS.map((a) => `[${a}]`).join(','), stripAdminLinks).transform(res) : res;
}

// ---------- entry ----------
export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const admin = (env.ADMIN_HOST ?? '').trim().toLowerCase();

    if (host === APEX) return redirect(`https://${WWW}${url.pathname}${url.search}`, request);
    if (url.pathname.startsWith('/ingest/')) return ingest(request, url);
    if (admin && host === admin) return finish(await adminHost(request, url, env, ctx), host);
    if (admin && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))) return redirect(`https://${admin}${unprefix(url.pathname)}${url.search}`, request);
    return finish(await handle(request, env, ctx), host);
  },

  /** Cron trigger (wrangler.jsonc triggers.crons): the daily job, run through the normal route so there is one implementation. */
  async scheduled(controller: { cron: string }, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET) throw new Error('cron: CRON_SECRET is not set, the daily job did not run');
    const res = await handle(new Request(`https://${WWW}/api/cron/daily/`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }), env, ctx);
    const body = await res.text();
    console.log(`cron ${controller.cron}: daily job answered ${res.status}`, body.slice(0, 1500));
    if (!res.ok) throw new Error(`cron: daily job answered ${res.status}`); // shows as a failed run in the Worker's cron history
  },
};
