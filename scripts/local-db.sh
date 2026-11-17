#!/usr/bin/env bash
# Spin up a throwaway PostgreSQL 16 cluster, apply the Supabase shim,
# all migrations and the seed. Used by the DB test-suite.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
DATA="${TPAC_PGDATA:-/tmp/tpac-pg}"
PORT="${TPAC_PGPORT:-54329}"
RUNAS=""
if [ "$(id -u)" = "0" ]; then RUNAS="runuser -u postgres --"; fi
if [ -d "$DATA" ]; then $RUNAS "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"; fi
mkdir -p "$DATA"; [ -n "$RUNAS" ] && chown postgres "$DATA"
$RUNAS "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
$RUNAS "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp" -l "$DATA/log" start >/dev/null
export PGHOST=/tmp PGPORT=$PORT PGUSER=postgres
psql -q -v ON_ERROR_STOP=1 -c "create database tpac" postgres
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/tests/db/supabase-shim.sql" tpac
for f in "$ROOT"/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f" tpac; done
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql" tpac
echo "postgres://postgres@localhost:$PORT/tpac?host=/tmp"
