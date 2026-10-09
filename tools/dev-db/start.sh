#!/usr/bin/env bash
# LOCAL DEV ONLY. Throwaway Supabase look-alike: Postgres 15 (:54329) + PostgREST (:54330) + /rest/v1 proxy (:54331) + deploy-hook echo (:54332).
#   start.sh up | down | reset | psql | env | jwt [role]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
# Everything it creates lives in DEVDB_HOME (default .dev-db/, git-ignored). Needs Postgres 15 binaries (PGBIN) and a PostgREST binary (PGREST_BIN, or `postgrest` on PATH;
# release binaries: https://github.com/PostgREST/postgrest/releases).
SCRATCH="${DEVDB_HOME:-$REPO/.dev-db}"
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@15/bin}"
PGREST="${PGREST_BIN:-$(command -v postgrest || echo "$SCRATCH/postgrest")}"
PGDATA="$SCRATCH/pg"
PG_PORT=54329 REST_PORT=54330 PROXY_PORT=54331 ECHO_PORT=54332

# Never let the user's own PG* env (or their :5432 server) leak into these commands.
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGSERVICE PGOPTIONS PGSSLMODE
export PGOPTIONS='-c client_min_messages=warning'
export LC_ALL=en_US.UTF-8   # macOS: postmaster refuses to start ("became multithreaded") with an unset/invalid locale

psqlx() { "$PGBIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }

# detached background process: start_bg <pidfile> <logfile> <cmd...>
start_bg() {
  local pidf=$1 logf=$2; shift 2
  alive "$pidf" && return 0
  nohup "$@" >>"$logf" 2>&1 </dev/null &
  echo $! >"$pidf"
  disown 2>/dev/null || true
}

stop_pid() {
  local pidf=$1 i
  alive "$pidf" || { rm -f "$pidf"; return 0; }
  kill "$(cat "$pidf")" 2>/dev/null || true
  for i in 1 2 3 4 5 6 7 8 9 10; do alive "$pidf" || break; sleep 0.5; done
  alive "$pidf" && kill -9 "$(cat "$pidf")" 2>/dev/null || true
  rm -f "$pidf"
}

wait_http() { # url, label
  local i
  for i in $(seq 1 40); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done
  echo "$2 did not come up; see $SCRATCH/*.log" >&2; return 1
}

mint() { # HS256 JWT for role $1, signed with the persisted secret
  node -e '
    const c = require("crypto"), b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: process.argv[1], iss: "local", exp: 4102444800 });
    const s = c.createHmac("sha256", require("fs").readFileSync(process.argv[2], "utf8").trim()).update(h + "." + p).digest("base64url");
    console.log(h + "." + p + "." + s);
  ' "$1" "$SCRATCH/jwt-secret.txt"
}

secret() {
  [ -s "$SCRATCH/jwt-secret.txt" ] || node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))' >"$SCRATCH/jwt-secret.txt"
  cat "$SCRATCH/jwt-secret.txt"
}

cmd_up() {
  mkdir -p "$SCRATCH"
  [ -x "$PGREST" ] || { echo "PostgREST binary not found at $PGREST" >&2; exit 1; }

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    "$PGBIN/initdb" -D "$PGDATA" -U postgres --auth=trust -E UTF8 --locale=en_US.UTF-8 >/dev/null
    cat >>"$PGDATA/postgresql.conf" <<EOF

# --- dev-db ---
port = $PG_PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = ''
timezone = 'UTC'
log_timezone = 'UTC'
max_connections = 40
fsync = off
EOF
  fi
  "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 || "$PGBIN/pg_ctl" -D "$PGDATA" -l "$SCRATCH/pg.log" -w start >/dev/null

  psqlx -d postgres -tAc "select 1 from pg_database where datname = 'alytech'" | grep -q 1 || psqlx -d postgres -c 'create database alytech'

  # Supabase's role model + default privileges, applied BEFORE the schema so new objects inherit them.
  psqlx -d alytech <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then create role authenticator login password 'authpw' noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

  # schema.sql must succeed, and succeed again (it claims to be re-runnable)
  local n
  for n in 1 2; do
    if psqlx -d alytech -f "$REPO/supabase/schema.sql"; then echo "schema.sql run #$n: ok"; else echo "schema.sql run #$n: FAILED" >&2; exit 1; fi
  done

  if [ -f "$REPO/tools/seed-demo.sql" ] && [ "$(psqlx -d alytech -tAc 'select count(*) from leads')" = 0 ]; then
    psqlx -d alytech -f "$REPO/tools/seed-demo.sql" && echo "seed-demo.sql: applied"
  fi

  start_bg "$SCRATCH/postgrest.pid" "$SCRATCH/postgrest.log" env \
    DYLD_FALLBACK_LIBRARY_PATH="${PGBIN%/bin}/lib" \
    PGRST_DB_URI="postgres://authenticator:authpw@127.0.0.1:$PG_PORT/alytech" \
    PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_DB_MAX_ROWS=1000 PGRST_DB_POOL=3 \
    PGRST_JWT_SECRET="$(secret)" PGRST_SERVER_HOST=127.0.0.1 PGRST_SERVER_PORT=$REST_PORT \
    "$PGREST"
  wait_http "http://127.0.0.1:$REST_PORT/" postgrest

  start_bg "$SCRATCH/proxy.pid" "$SCRATCH/proxy.log" env PROXY_PORT=$PROXY_PORT UPSTREAM_PORT=$REST_PORT node "$HERE/proxy.mjs"
  start_bg "$SCRATCH/echo.pid" "$SCRATCH/echo-stdout.log" env ECHO_PORT=$ECHO_PORT ECHO_LOG="$SCRATCH/echo.log" node "$HERE/echo.mjs"
  wait_http "http://127.0.0.1:$PROXY_PORT/nothing" proxy
  wait_http "http://127.0.0.1:$ECHO_PORT/last" echo
  echo "up: postgres :$PG_PORT  postgrest :$REST_PORT  proxy :$PROXY_PORT  echo :$ECHO_PORT"
}

cmd_down() {
  stop_pid "$SCRATCH/echo.pid"
  stop_pid "$SCRATCH/proxy.pid"
  stop_pid "$SCRATCH/postgrest.pid"
  if [ -f "$PGDATA/PG_VERSION" ]; then "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1 && "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop >/dev/null || true; fi
  echo "down"
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  reset) cmd_down; rm -rf "$PGDATA"; cmd_up ;;
  psql) shift; exec "$PGBIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d alytech "$@" ;;
  jwt) secret >/dev/null; mint "${2:-service_role}" ;;
  env)
    secret >/dev/null
    echo "SUPABASE_URL=http://127.0.0.1:$PROXY_PORT"
    echo "SUPABASE_SERVICE_ROLE_KEY=$(mint service_role)"
    echo "DEPLOY_HOOK_URL=http://127.0.0.1:$ECHO_PORT/hook"
    ;;
  *) echo "usage: $0 up | down | reset | psql | env | jwt [role]" >&2; exit 2 ;;
esac
