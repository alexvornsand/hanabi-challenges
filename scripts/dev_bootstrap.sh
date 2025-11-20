#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

echo "Starting Docker services (db)..."
docker compose up -d db

echo "Waiting for database to be ready..."
"${ROOT_DIR}/scripts/wait_for_db.sh"

echo "Resetting dev database (schema + sample data)..."
"${ROOT_DIR}/scripts/dev_db_reset.sh"