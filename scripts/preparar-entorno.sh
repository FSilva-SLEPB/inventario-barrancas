#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
umask 077

if [ ! -f .env ]; then
  printf 'LOCAL_UID=%s\nLOCAL_GID=%s\n' "$(id -u)" "$(id -g)" > .env
fi

chmod 600 .env

if ! grep -q '^POSTGRES_PASSWORD=.' .env; then
  clave_postgres="$(docker run --rm --network none node:24-bookworm-slim \
    node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  sed -i '/^POSTGRES_PASSWORD=$/d' .env
  printf '\nPOSTGRES_PASSWORD=%s\n' "$clave_postgres" >> .env
fi
