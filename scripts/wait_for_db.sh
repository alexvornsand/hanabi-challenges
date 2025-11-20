#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."

for i in {1..30}; do
  if nc -z "${DB_HOST}" "${DB_PORT}" ; then
    echo "Postgres is up."
    exit 0
  fi
  echo "Postgres not ready..."
  sleep 1
done

echo "Postgres failed to start in time."
exit 1
