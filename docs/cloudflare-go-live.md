# Going live on Cloudflare (runbook for the owner)

This moves the website from Vercel to Cloudflare Workers. Nothing here changes how the site looks or what it does. The same code still builds for Vercel (`npm run build`), so Vercel stays a working fallback until you decide to remove it.

**Where things end up**

| Address | What it is |
| --- | --- |
| `https://www.alytechme.com` | the public website |
| `https://alytechme.com` | redirects to `www` |
| `https://admin.alytechme.com` | the admin panel (clean addresses: `/leads/`, not `/admin/leads/`) |
| `https://alytech-scientific.<your-name>.workers.dev` | the test address you get on the first deploy (hidden from Google) |

You need: a free Cloudflare account, login access to OVH (where `alytechme.com` is registered), and a terminal open **inside the `alytech-scientific/` folder** for every command below.

The words in `code style` are things you type or click exactly as written. Lines starting with `$` are terminal commands (do not type the `$`).

---

## 1. Log in to Cloudflare from your computer

```
$ npx wrangler login
```

A browser tab opens. Click **Allow**. Back in the terminal you should see "Successfully logged in".
Check it worked: `npx wrangler whoami` prints your Cloudflare account name.

## 2. Store the secrets

Secrets are the private values (database key, passwords). They live inside Cloudflare, never in the code. For each name run the command, then paste the value when asked (the screen shows nothing while you paste; press Enter).

```
$ npx wrangler secret put SUPABASE_URL
```

If wrangler says the Worker `alytech-scientific` does not exist yet and offers to create it, answer **y** (it makes an empty placeholder; step 3 fills it).

Easiest and safest: **copy the values that are already in Vercel** (Vercel → the project → Settings → Environment Variables → click the eye icon). Then the team's admin logins and emails behave exactly as today.

| Name | Needed? | Where the value comes from |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Supabase dashboard → Project Settings → API → Project URL (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase dashboard → Project Settings → API Keys → the **secret** key (the legacy name is "service_role"). Never the publishable/anon key |
| `ADMIN_SECRET` | yes | 32+ random characters. Same value as Vercel keeps sessions valid; or make a new one with `openssl rand -base64 48` (everyone signs in again) |
| `ADMIN_PASSWORD` | yes | the one-time setup password (only used while no admin account exists, or for emergency "break-glass" access) |
| `CRON_SECRET` | yes | any long random text, e.g. `openssl rand -hex 32`. Without it the 08:00 daily job does not run |
| `RESEND_API_KEY` | for emails | resend.com → API Keys |
| `LEAD_ALERT_TO` | for emails | who gets the instant lead alert, comma separated |
| `LEAD_ALERT_FROM` | for emails | e.g. `AlyTech Website <leads@alytechme.com>` |
| `IPINFO_TOKEN` | optional | ipinfo.io → your token (company lookup from visitor IP) |
| `POSTHOG_PROJECT_ID` | optional | the number in your PostHog project address (`eu.posthog.com/project/<number>`) |
| `DEPLOY_HOOK_URL` | optional | see step 6 (makes Settings → "Save & publish" rebuild the site) |
| `ADMIN_HOST` | later | set in step 5, **not yet** |

Also supported if you use them today: `ADMIN_BREAKGLASS`, `POSTHOG_SHARED_DASHBOARD_URL` (see `.env.example`).

**Two values the *build* needs on your computer** (so the pages show your current WhatsApp number, announcement bar and hours, and PostHog works):

1. Create a file named `.dev.vars` in this folder with two lines (it is never uploaded or committed):
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=the-secret-key
   ```
2. Create a file named `.env` in this folder with one line (the PostHog *project API key*, starts with `phc_`, also never committed):
   ```
   PUBLIC_POSTHOG_KEY=phc_xxxxxxxx
   ```

Skip either file and the site still builds: it just uses the defaults from `src/data/site.ts` / has no analytics until you add it and deploy again.

## 3. First deploy, and test it on the temporary address

```
$ npm run deploy:cf
```

This builds the site (about a minute) and uploads it. If it asks you to choose a `workers.dev` name, pick anything (e.g. `alytech`). At the end it prints the address `https://alytech-scientific.<name>.workers.dev`.

Open that address and check:

- [ ] Home page loads and the 3D instrument appears after a moment. `/ar/` shows Arabic, right-to-left.
- [ ] A product page (e.g. `/gasmix/aiolos-iii/`) and the gas dilution calculator open and calculate.
- [ ] `/aiolos.html` jumps to `/gasmix/aiolos-iii/` (old links keep working).
- [ ] Click **Accept** on the cookie banner, then WhatsApp on a product: the chat opens with the product name.
- [ ] `/admin/login/` shows the sign-in page. (The `ADMIN_HOST` secret is not set yet, so the panel is still at `/admin/` here.) Sign in or run the first-time setup.
- [ ] In the admin: Enquiries, WhatsApp, Visitors open without an error page. If **sign-in** fails with *"Error 1102 / Worker exceeded resource limits"*, see "Plan limits" below.
- [ ] Daily job (needs `CRON_SECRET`). Replace the two placeholders and run:
  `curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://alytech-scientific.NAME.workers.dev/api/cron/daily/?dry=1"` → it prints `"ok": true` (dry run: nothing is deleted or emailed). In the Cloudflare dashboard → Workers & Pages → `alytech-scientific` → Settings → Triggers you will see the schedule `0 4 * * *` (04:00 UTC = 08:00 Dubai).
- [ ] The page is hidden from Google: `curl -sI https://alytech-scientific.NAME.workers.dev/ | grep -i x-robots` → `noindex, nofollow`.

If something is wrong, `npx wrangler tail` shows the live error log.

**Plan limits to know (free plan).** Static pages and images are free and unlimited. The Worker itself runs for the home page, `/api/*`, `/ingest/*` and the admin; the free plan allows 100,000 such runs per day and about 10 ms of processing per run. A normal visit is far below that. Signing in to the admin checks a password with 100,000 rounds of hashing, which can use close to 10 ms: if sign-in fails with error 1102, switch the account to **Workers Paid** (US$5/month, dashboard → Workers & Pages → Plans); nothing else changes.

## 4. Move the domain's DNS to Cloudflare (keep the email working)

Cloudflare must manage the DNS of `alytechme.com`. Your email (OVH) keeps working as long as its records are copied across.

1. Cloudflare dashboard → **Add a domain** (or "Onboard a domain") → type `alytechme.com` → choose the **Free** plan.
2. Cloudflare scans and imports the current DNS records. **Do not trust the import blindly.** In a second browser tab open OVH → Web Cloud → Domain names → `alytechme.com` → **DNS zone**, and tick every record off against Cloudflare's list. Make sure these exist in Cloudflare:
   - the **MX** records `mx3.mail.ovh.net` and `mx4.mail.ovh.net` (keep the same priorities as in OVH),
   - every **TXT** record for email: the SPF record (starts `v=spf1`), DKIM records, `_dmarc`, and any Resend records (`resend._domainkey…`, `send…`),
   - mail-related **CNAME** records such as `mail`, `imap`, `smtp`, `pop3`, `autodiscover`.
   Set all of these to **DNS only** (grey cloud), never "Proxied" (orange). Add anything missing by hand with the same name, type, value.
3. Leave the existing `@` (alytechme.com) and `www` records alone for now: they still point at the old hosting, so the old site keeps working until step 5.
4. If DNSSEC is switched on at OVH (OVH → the domain → DNSSEC), switch it **off** first, or the domain will stop resolving after the change.
5. Cloudflare shows two **nameservers** (like `xxx.ns.cloudflare.com`). In OVH → the domain → **DNS servers** → **Modify DNS servers** → replace the current ones with those two → confirm.
6. Wait. Usually 15 minutes to a few hours (OVH says up to 24 h). Cloudflare emails you and the domain shows **Active**. Do not continue until it is Active.
7. After it is Active, send yourself a test email to an @alytechme.com address and one from it, to confirm mail still works.

## 5. Attach the real addresses

1. Cloudflare → alytechme.com → **DNS → Records**: delete the old `@` and `www` records that point to the old hosting (and `admin`, if one exists). Cloudflare refuses to attach a Worker to a name that already has such a record. The site is only unreachable for the few seconds until the next sub-step. Do not touch the mail records.
2. Workers & Pages → `alytech-scientific` → **Settings → Domains & Routes → Add → Custom domain**. Add, one at a time: `www.alytechme.com`, `alytechme.com`, `admin.alytechme.com`. Cloudflare creates the DNS records and certificates itself (a few minutes).
3. Turn the admin on its own address:
   ```
   $ npx wrangler secret put ADMIN_HOST
   ```
   Paste `admin.alytechme.com` (no `https://`). From now on `https://admin.alytechme.com/` is the admin panel and `https://www.alytechme.com/admin/…` redirects there.
4. Send `alytechme.com` to `www` (the one rule you create by hand): Cloudflare → alytechme.com → **Rules → Redirect Rules → Create rule**
   - Rule name: `apex to www`
   - When incoming requests match → **Custom filter expression** → Field **Hostname**, operator **equals**, value `alytechme.com`
   - Then → Type **Dynamic**, Expression: `concat("https://www.alytechme.com", http.request.uri.path)`
   - Status code **301**, tick **Preserve query string**
   - **Deploy**.
   (The Worker also redirects the apex for the few paths that reach it, as a safety net.)
5. Test: `https://alytechme.com/gasmix/` lands on `https://www.alytechme.com/gasmix/`; `https://admin.alytechme.com/` shows the sign-in page.

## 6. Optional: deploy automatically when code changes

Instead of running `npm run deploy:cf` yourself, Cloudflare can build and deploy from GitHub on every push.

1. Workers & Pages → `alytech-scientific` → **Settings → Builds → Connect** → GitHub → pick the repository and the `master` branch.
2. Build command: `npm run build:cf`  Deploy command: `npx wrangler deploy`
3. **Build variables and secrets** (these are only for the build, separate from step 2):
   `DEPLOY_TARGET` = `cloudflare`, `PUBLIC_POSTHOG_KEY` = your `phc_…` key, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (as a secret), and `NODE_VERSION` = `24`.
4. To make **Settings → "Save & publish"** in the admin rebuild the site: **Settings → Builds → Deploy Hooks → Create**, choose the branch, copy the URL, then `npx wrangler secret put DEPLOY_HOOK_URL` and paste it.

## 7. After the new site has been live for a few days

1. Vercel: leave the project in place as a fallback (it is hidden from Google on its `.vercel.app` address). If `www.alytechme.com` or `alytechme.com` was ever added to the Vercel project (Settings → Domains), remove it there so Vercel no longer claims the name.
2. Cancel the GoDaddy hosting **only after** you have downloaded a full backup of the old site (files and any database) from the GoDaddy panel. Keep that backup somewhere safe.
3. Google Search Console: add `https://www.alytechme.com` if it is not there, and re-submit `https://www.alytechme.com/sitemap-index.xml`.
4. PostHog and Supabase need **no changes**: PostHog's authorized URLs already include `www.alytechme.com`, and Supabase is only ever called by the Worker (no allow-list).

**Going back to Vercel** (if ever needed): in Cloudflare DNS delete the three Worker custom domains and add `CNAME www → cname.vercel-dns.com` (DNS only), then re-add the domain in the Vercel project.

## 8. Final checklist

Run these (replace nothing):

```
$ curl -sI https://alytechme.com/gasmix/ | grep -i "^HTTP\|^location"
  → 301 and location: https://www.alytechme.com/gasmix/
$ curl -sI https://www.alytechme.com/ | grep -i "strict-transport\|content-security\|x-content-type\|referrer-policy\|permissions-policy\|x-robots"
  → the five security headers, and NO x-robots-tag
$ curl -sI https://www.alytechme.com/aiolos.html | grep -i "^HTTP\|^location"
  → 301 → /gasmix/aiolos-iii/
$ curl -sI https://www.alytechme.com/admin/ | grep -i "^HTTP\|^location"
  → 301 → https://admin.alytechme.com/
$ curl -s https://admin.alytechme.com/robots.txt
  → Disallow: /
$ curl -sI https://admin.alytechme.com/login/ | grep -i "x-robots\|cache-control"
  → noindex, nofollow and no-store
$ curl -s https://www.alytechme.com/robots.txt
  → the public robots.txt (Allow: /, sitemap line)
$ curl -s -o /dev/null -w "%{http_code}\n" https://www.alytechme.com/ingest/static/array.js
  → 200
```

In a browser:

- [ ] Home page: 3D instrument shows, no console errors. `/ar/` is right-to-left.
- [ ] Accept cookies, then in PostHog (EU) a live visit appears within a minute.
- [ ] Submit a test enquiry (or WhatsApp click): it appears in `https://admin.alytechme.com/leads/` or `/whatsapp/`, and the alert email arrives.
- [ ] Admin: sign in, click every menu item, sign out. Addresses never contain `/admin`.
- [ ] Send and receive a test email on an @alytechme.com address.
- [ ] Next morning after 08:00 Dubai time: Workers & Pages → `alytech-scientific` → Logs shows a `cron 0 4 * * *` line, and the follow-up/digest emails arrive (if Resend is set).

## Appendix: running it on your computer

```
$ npm run dev:cf
```

builds, then serves the Cloudflare version at `http://localhost:8787` using the secrets in `.dev.vars` (add `ADMIN_SECRET`, `ADMIN_PASSWORD`, `CRON_SECRET`, `ADMIN_HOST` there to try the admin). To trigger the daily job by hand while it runs: `curl "http://localhost:8787/cdn-cgi/local/scheduled"`.

The Vercel build is unchanged: `npm run build`. The two builds share all code; only `src/worker.ts`, `wrangler.jsonc` and `cloudflare/` are Cloudflare-specific.
