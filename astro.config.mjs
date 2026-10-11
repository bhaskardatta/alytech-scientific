import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { createHash } from 'node:crypto';
import { announceBoot } from './src/lib/announce-boot.mjs';

// One codebase, two hosts. `DEPLOY_TARGET=cloudflare` (npm run build:cf) builds for Cloudflare Workers; anything else is the Vercel build, unchanged.
// Imported lazily so a Vercel build never loads the Cloudflare tooling and vice versa.
const cf = process.env.DEPLOY_TARGET === 'cloudflare';
const adapter = cf
  // ponytail: no astro:assets images on this site (only the Font component), so no Images binding / sharp: images are served as they are.
  ? (await import('@astrojs/cloudflare')).default({ imageService: 'passthrough' })
  : (await import('@astrojs/vercel')).default();

// Self-hosted at build time (no runtime request to Google), with metric-matched fallbacks to avoid layout shift.
// Text faces keep latin-ext as lazy unicode-range files (only fetched if a page uses e.g. superscripts); Base.astro
// preloads just the critical latin faces. The Arabic families are emitted only on /ar/ pages.
const google = fontProviders.google();
const face = (name, cssVariable, o = {}) => ({ provider: google, name, cssVariable, styles: ['normal'], subsets: ['latin', 'latin-ext'], ...o });

export default defineConfig({
  site: 'https://www.alytechme.com',
  trailingSlash: 'always',
  // Static by default; /api/* and /admin/* opt out with `prerender = false`.
  adapter,
  // The Cloudflare adapter would otherwise provision a Workers KV namespace for sessions. This site has no sessions (admin uses its own signed cookie).
  ...(cf && { session: false }),
  // Hash-based CSP: Astro adds a <meta> CSP per page with script-src/style-src hashes for every inline script and style it
  // emits (no 'unsafe-inline'). frame-ancestors can't be set from <meta>, so vercel.json sends it as a header.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        // The admin Analytics page can embed a shared PostHog dashboard (POSTHOG_SHARED_DASHBOARD_URL); the office map (OfficeMap.astro,
        // loaded on click) is a Google Maps embed. Nothing else on the site frames anything.
        'frame-src https://eu.posthog.com https://www.google.com',
      ],
      // The announcement bar's tiny pre-paint script is inline (Astro hashes its own bundled scripts, not is:inline ones), so its hash is added here.
      scriptDirective: { hashes: [`sha256-${createHash('sha256').update(announceBoot).digest('base64')}`] },
    },
  },
  // Server secrets are read through one helper (src/lib/env.ts -> getSecret), never import.meta.env, so the host can change (Vercel -> Cloudflare Workers).
  // PUBLIC_POSTHOG_KEY is the one client-side value and is baked in at build time with import.meta.env.
  env: {
    schema: Object.fromEntries(
      [
        'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_SECRET', 'ADMIN_PASSWORD', 'ADMIN_BREAKGLASS', 'IPINFO_TOKEN',
        'RESEND_API_KEY', 'LEAD_ALERT_TO', 'LEAD_ALERT_FROM', 'POSTHOG_PROJECT_ID', 'POSTHOG_SHARED_DASHBOARD_URL', 'CRON_SECRET', 'DEPLOY_HOOK_URL',
      ].map((k) => [k, envField.string({ context: 'server', access: 'secret', optional: true })]),
    ),
  },
  markdown: { syntaxHighlight: false }, // no markdown here; Shiki's inline styles would also clash with the CSP
  fonts: [
    // ponytail: the design only ever sets Archivo at wdth 112 / weight 600 (.display), and Google serves that single instance at
    // 37 KB vs 90 KB for the full wdth+wght variable file. For other widths/weights restore weights ['400 700'] and variableAxis wdth [['62','125']].
    // Fallback is hand-tuned in global.css (Astro's auto metrics assume the default width and come out 20% too wide).
    face('Archivo', '--font-archivo', { weights: [600], options: { experimental: { variableAxis: { wdth: ['112'] } } }, fallbacks: [], optimizedFallbacks: false }),
    face('IBM Plex Sans', '--font-plex', { weights: [400, 500, 600] }),
    face('JetBrains Mono', '--font-jetbrains', { weights: [400, 500], fallbacks: ['monospace'] }),
    // ponytail: Arabic display = one static weight (44 KB) instead of the 124 KB variable file; body drops 500 (renders as 400).
    // No portable metric-matched fallback exists for Arabic (the system face differs per OS), so these rely on the preload in Base.astro to land
    // before first paint. If field CLS on /ar/ ever shows font-swap shifts, add display: 'optional' here (trade: system Arabic on a slow first view).
    face('IBM Plex Sans Arabic', '--font-plex-ar', { weights: [400, 600], subsets: ['arabic', 'latin'] }),
    face('Noto Kufi Arabic', '--font-kufi', { weights: [700], subsets: ['arabic', 'latin'] }),
  ],
  integrations: [
    // Cloudflare only: writes dist/client/_headers + _redirects from vercel.json (the single source for headers and legacy redirects).
    ...(cf ? [(await import('./cloudflare/assets-rules.mjs')).default()] : []),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ar: 'ar' } },
      // /search/ is noindex; /admin/ and /thank-you/ are not for crawlers.
      filter: (page) => !/\/(admin|thank-you|search)\//.test(page),
      lastmod: new Date(),
    }),
  ],
  // __CLOUDFLARE__ (src/env.d.ts) tells src/lib/platform.ts which host's IP/geo headers to trust.
  vite: { plugins: [tailwindcss()], define: { __CLOUDFLARE__: JSON.stringify(cf) } },
});
