/// <reference types="astro/client" />

/** Set by astro.config.mjs: true only in the Cloudflare build (npm run build:cf). */
declare const __CLOUDFLARE__: boolean;

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts for every /admin/* request. */
    user: import('./lib/auth').AdminUser | null;
  }
}
