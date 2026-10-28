#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -gt 1 ] || [ "${1:-}" = "--help" ]; then
  printf '%s\n' 'Uso: bash scripts/respaldar-postgresql.sh [directorio_destino]' >&2
  exit 1
fi

raiz_respaldos="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd -- "$raiz_respaldos"
command -v docker >/dev/null || { printf '%s\n' 'Docker no está disponible.' >&2; exit 1; }

origen_respaldos="${RESPALDO_DB_CONTAINER:-}"
if [ -z "$origen_respaldos" ]; then
  origen_respaldos="$(docker compose ps --quiet db)"
fi
if [[ ! "$origen_respaldos" =~ ^[a-f0-9]{12,64}$ ]]; then
  printf '%s\n' 'No se identificó el contenedor de PostgreSQL. Inicia el servicio db.' >&2
  exit 1
fi

# Las credenciales se leen dentro del contenedor y no se imprimen ni se guardan.
en_base_origen() {
  docker exec "$origen_respaldos" sh -ec '
    : "${POSTGRES_DB:?}" "${POSTGRES_USER:?}" "${POSTGRES_PASSWORD:?}"
    [ "$POSTGRES_DB" = "inventario" ] || exit 1
    export PGHOST=127.0.0.1 PGDATABASE="$POSTGRES_DB" PGUSER="$POSTGRES_USER"
    export PGPASSWORD="$POSTGRES_PASSWORD" PGCONNECT_TIMEOUT=10
    exec "$@"
  ' sh "$@"
}

version_servidor="$(en_base_origen psql -X --no-password --tuples-only --no-align \
  -v ON_ERROR_STOP=1 --command='SHOW server_version_num')"
version_cliente="$(en_base_origen pg_dump --version)"
if [[ ! "$version_servidor" =~ ^18[0-9]{4}$ ]] \
    || [[ ! "$version_cliente" =~ ^pg_dump\ \(PostgreSQL\)\ 18\. ]]; then
  printf '%s\n' 'Este procedimiento requiere servidor y herramientas de PostgreSQL 18.' >&2
  exit 1
fi

destino_respaldos="${1:-$raiz_respaldos/backups/postgresql}"
mkdir -p -- "$destino_respaldos"
destino_respaldos="$(cd -- "$destino_respaldos" && pwd -P)"
if [[ "$destino_respaldos" = "$raiz_respaldos/"* ]] \
    && ! git check-ignore --quiet -- "$destino_respaldos/comprobar-exclusion"; then
  printf '%s\n' 'El destino dentro del repositorio debe estar excluido de Git.' >&2
  exit 1
fi

fecha_respaldo="$(date -u +%Y%m%dT%H%M%SZ)"
parcial_respaldo="$(mktemp -d "$destino_respaldos/.parcial-${fecha_respaldo}.XXXXXXXX")"
trap 'if [ -n "$parcial_respaldo" ] && [ -d "$parcial_respaldo" ]; then rm -rf -- "$parcial_respaldo"; fi' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf '%s\n' 'Creando el respaldo de PostgreSQL…' >&2
en_base_origen pg_dump --no-password --format=custom \
  --compress=gzip:level=6 --lock-wait-timeout=10s \
  > "$parcial_respaldo/inventario.dump"
en_base_origen pg_dumpall --no-password --database=inventario \
  --roles-only --no-role-passwords > "$parcial_respaldo/roles.sql"

test -s "$parcial_respaldo/inventario.dump"
test -s "$parcial_respaldo/roles.sql"
docker exec -i "$origen_respaldos" pg_restore --list \
  < "$parcial_respaldo/inventario.dump" > /dev/null

commit_respaldo="$(git rev-parse --verify HEAD 2>/dev/null || printf '%s' 'sin-commit')"
printf 'formato=1\nproyecto=inventario-barrancas\nbase=inventario\npostgres_major=18\nservidor=%s\ncliente=%s\ncreado_utc=%s\ncommit=%s\n' \
  "$version_servidor" "$version_cliente" "$fecha_respaldo" "$commit_respaldo" \
  > "$parcial_respaldo/metadatos.txt"
(
  cd -- "$parcial_respaldo"
  sha256sum inventario.dump roles.sql metadatos.txt > SHA256SUMS
)
chmod 600 -- "$parcial_respaldo/inventario.dump" "$parcial_respaldo/roles.sql" \
  "$parcial_respaldo/metadatos.txt" "$parcial_respaldo/SHA256SUMS"

nombre_respaldo="inventario_${fecha_respaldo}_${parcial_respaldo##*.}"
carpeta_respaldo="$destino_respaldos/$nombre_respaldo"
mv --no-clobber --no-target-directory -- "$parcial_respaldo" "$carpeta_respaldo"
if [ -d "$parcial_respaldo" ]; then
  printf '%s\n' 'El destino ya existe. Se canceló la copia para conservarlo.' >&2
  exit 1
fi
parcial_respaldo=""
printf 'Respaldo creado: %s\n' "$carpeta_respaldo" >&2
# La salida estándar contiene solamente la ruta, para encadenar la verificación.
printf '%s\n' "$carpeta_respaldo"
