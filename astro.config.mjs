import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Self-hosted at build time (no runtime request to Google), with metric-matched fallbacks to avoid layout shift.
// Text faces keep latin-ext as lazy unicode-range files (only fetched if a page uses e.g. superscripts); Base.astro
// preloads just the critical latin faces. The Arabic families are emitted only on /ar/ pages.
const google = fontProviders.google();
const face = (name, cssVariable, o = {}) => ({ provider: google, name, cssVariable, styles: ['normal'], subsets: ['latin', 'latin-ext'], ...o });

export default defineConfig({
  site: 'https://www.alytechme.com',
  trailingSlash: 'always',
  // Static by default; /api/* and /admin/* opt out with `prerender = false`.
  adapter: vercel(),
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
      ],
    },
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
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ar: 'ar' } },
      // /search/ is noindex; /admin/ and /thank-you/ are not for crawlers.
      filter: (page) => !/\/(admin|thank-you|search)\//.test(page),
      lastmod: new Date(),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
