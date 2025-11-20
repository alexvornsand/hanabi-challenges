#!/usr/bin/env bash
set -euo pipefail

HOST="${DB_HOST:-localhost}"
PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at ${HOST}:${PORT}..."

while ! nc -z "${HOST}" "${PORT}"; do
  sleep 1
done

echo "Postgres is up."
