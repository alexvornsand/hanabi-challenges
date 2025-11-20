#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-hanabi_db_test}"
DB_NAME="${DB_NAME:-hanabi_test}"
DB_USER="${DB_USER:-hanabi_user}"
DB_PASSWORD="${DB_PASSWORD:-hanabi_password}"

SCHEMA_FILE="${ROOT_DIR}/backend/schema/schema.sql"

if [ ! -f "${SCHEMA_FILE}" ]; then
  echo "Schema file not found at ${SCHEMA_FILE}"
  exit 1
fi

echo "🧪 Starting test database container..."
docker compose -f "${ROOT_DIR}/docker-compose.test.yml" up -d db_test

echo "⏳ Waiting for test Postgres to be ready on localhost:55432..."
# reuse your existing wait_for_db.sh, but point it at port 55432
DB_HOST=localhost DB_PORT=55432 "${ROOT_DIR}/scripts/wait_for_db.sh"

echo "📜 Applying schema to test database..."
docker exec -i \
  -e PGPASSWORD="${DB_PASSWORD}" \
  "${DB_CONTAINER_NAME}" \
  psql -U "${DB_USER}" -d "${DB_NAME}" < "${SCHEMA_FILE}"

echo "✅ Test database is ready (schema applied)."
