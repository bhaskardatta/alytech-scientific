/**
 * Every /admin/* request is authenticated and authorised here, on the server, before any page code runs:
 *   - no session -> sign-in; first-time setup session -> only /admin/setup/; temporary password -> only /admin/account/
 *   - settings / users / activity pages need the owner role
 *   - any write (POST) needs owner or sales, except signing in/out and changing your own password
 * Pages add finer checks (e.g. only owners may delete a lead).
 */
import { defineMiddleware } from 'astro:middleware';
import { currentUser, can, type Perm } from './lib/auth';

const OWNER_ONLY = /^\/admin\/(settings|users|activity)\//;
const OPEN_TO_ALL_WRITES = /^\/admin\/(login|account)\/$/;

const redirect = (to: string) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store' } });
const noStore = (res: Response) => { try { res.headers.set('cache-control', 'no-store'); } catch { /* immutable response: the layout already sets it */ } return res; };

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  if (!path.startsWith('/admin')) return next();

  const user = await currentUser(ctx.cookies);
  ctx.locals.user = user;
  if (path === '/admin/login/') return noStore(await next());
  if (!user) return redirect('/admin/login/');
  if (user.kind === 'bootstrap') return path === '/admin/setup/' ? noStore(await next()) : redirect('/admin/setup/');
  if (path === '/admin/setup/') return redirect('/admin/');
  if (user.mustChange && path !== '/admin/account/') return redirect('/admin/account/?must=1');

  const writing = ctx.request.method !== 'GET' && ctx.request.method !== 'HEAD';
  const need: Perm = OWNER_ONLY.test(path) ? 'owner' : writing && !OPEN_TO_ALL_WRITES.test(path) ? 'write' : 'read';
  if (!can(user, need)) {
    return new Response(`Your role (${user.role}) cannot do that. Ask an owner.`, { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return noStore(await next());
});
