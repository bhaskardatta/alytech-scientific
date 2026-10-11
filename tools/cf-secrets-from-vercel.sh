#!/bin/bash
# Copies the production secrets from Vercel into the Cloudflare Worker, and the two build-time values into
# git-ignored local files (.dev.vars, .env). Prints names only, never values. Temp files are deleted on exit.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
npx vercel env pull "$tmp/vercel.env" --environment=production --yes >/dev/null 2>&1
python3 - "$tmp" <<'PY'
import json, sys
tmp = sys.argv[1]
env = {}
for line in open(f'{tmp}/vercel.env'):
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line: continue
    k, v = line.split('=', 1)
    if len(v) >= 2 and v[0] == v[-1] == '"': v = v[1:-1]
    env[k] = v
want = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_SECRET', 'ADMIN_PASSWORD', 'CRON_SECRET', 'POSTHOG_PROJECT_ID',
        'RESEND_API_KEY', 'LEAD_ALERT_TO', 'LEAD_ALERT_FROM', 'IPINFO_TOKEN', 'ADMIN_BREAKGLASS', 'POSTHOG_SHARED_DASHBOARD_URL']
secrets = {k: env[k] for k in want if env.get(k)}
json.dump(secrets, open(f'{tmp}/secrets.json', 'w'))
with open('.dev.vars', 'w') as f:
    for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'):
        if env.get(k): f.write(f'{k}={env[k]}\n')
if env.get('PUBLIC_POSTHOG_KEY'):
    open('.env', 'w').write(f"PUBLIC_POSTHOG_KEY={env['PUBLIC_POSTHOG_KEY']}\n")
print('Copying to Cloudflare:', ', '.join(secrets))
missing = [k for k in ('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_SECRET', 'CRON_SECRET') if k not in secrets]
if missing: print('MISSING in Vercel (add them there, then run this again):', ', '.join(missing))
PY
npx wrangler secret bulk "$tmp/secrets.json" 2>&1 | grep -E 'Success|secret|✘|ERROR' || true
echo "Done. Tell Claude: secrets copied."
