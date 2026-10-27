#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

docker compose run --rm --no-deps -T db sh -c '
  PGPASSWORD="$APP_DB_PASSWORD" psql -X \
    -h db -U inventario_app -d inventario \
    -v ON_ERROR_STOP=1 -f -
' < database/verificar-catalogos.sql
