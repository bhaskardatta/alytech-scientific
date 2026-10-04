import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://www.alytechme.com',
  trailingSlash: 'always',
  // Static by default; /api/* and /admin/* opt out with `prerender = false`.
  adapter: vercel(),
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', ar: 'ar' } },
      filter: (page) => !page.includes('/admin/') && !page.includes('/thank-you/'),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
