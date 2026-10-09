/**
 * PostHog product analytics + session replay (EU cloud). Loads only after the visitor clicks "Accept" and only when
 * PUBLIC_POSTHOG_KEY is set at build time; otherwise every export is a no-op. Traffic goes through /ingest (rewrite in
 * vercel.json), so it stays same-origin for the CSP and isn't dropped by ad blockers.
 */
import type { PostHog } from 'posthog-js';

const KEY = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined;
let ph: PostHog | undefined;
let loading: Promise<PostHog | undefined> | undefined;

const consented = () => { try { return localStorage.getItem('aly-consent') === 'all'; } catch { return false; } };

function load() {
  if (!KEY) return Promise.resolve(undefined);
  return (loading ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(KEY, {
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-08-30',
      person_profiles: 'identified_only', // anonymous visitors only; we never send names or emails to PostHog
      capture_pageleave: true,
      capture_performance: { web_vitals: true },
      capture_exceptions: true,
      capture_dead_clicks: true,
      enable_heatmaps: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
    });
    return (ph = posthog);
  }));
}

export const capture = (event: string, props: Record<string, unknown> = {}) => ph?.capture(event, props);
/** Lets the admin panel link a lead or WhatsApp click to its session replay. */
export const phSession = () => ph?.get_session_id();

if (consented()) {
  const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
  idle(() => load());
}
addEventListener('aly-consent', (e) => {
  if ((e as CustomEvent).detail === 'all') load().then((p) => p?.opt_in_capturing());
  else if (ph) { ph.opt_out_capturing(); ph.reset(); }
});
