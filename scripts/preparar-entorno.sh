#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
umask 077

if [ ! -f .env ]; then
  printf 'LOCAL_UID=%s\nLOCAL_GID=%s\n' "$(id -u)" "$(id -g)" > .env
fi

chmod 600 .env

for variable in POSTGRES_PASSWORD APP_DB_PASSWORD; do
  if ! grep -q "^${variable}=." .env; then
    clave_postgres="$(docker run --rm --network none node:24-bookworm-slim \
      node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
    sed -i "/^${variable}=$/d" .env
    printf '\n%s=%s\n' "$variable" "$clave_postgres" >> .env
  fi
done
