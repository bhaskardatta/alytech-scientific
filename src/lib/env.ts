/** The ONE place server code reads environment variables (astro:env, so the host can change without touching app code). */
import { getSecret } from 'astro:env/server';

export type SecretName =
  | 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'ADMIN_SECRET' | 'ADMIN_PASSWORD' | 'ADMIN_BREAKGLASS' | 'IPINFO_TOKEN'
  | 'RESEND_API_KEY' | 'LEAD_ALERT_TO' | 'LEAD_ALERT_FROM' | 'POSTHOG_PROJECT_ID' | 'POSTHOG_SHARED_DASHBOARD_URL' | 'CRON_SECRET' | 'DEPLOY_HOOK_URL';

/** Read lazily (inside functions), never at module load: on some hosts the bindings only exist per request. */
export const secret = (name: SecretName): string | undefined => getSecret(name) || undefined;
