#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] \
    || { [ "$#" -eq 2 ] && [ "$2" != "--datos-ci" ]; }; then
  printf '%s\n' 'Uso: bash scripts/verificar-respaldo-postgresql.sh directorio_respaldo [--datos-ci]' >&2
  exit 1
fi

carpeta_respaldo="$(cd -- "$1" && pwd -P)"
raiz_respaldos="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
validar_datos_ci=false
if [ "${2:-}" = "--datos-ci" ]; then validar_datos_ci=true; fi
command -v docker >/dev/null || { printf '%s\n' 'Docker no está disponible.' >&2; exit 1; }
test -f "$raiz_respaldos/database/verificar-restauracion.sql"

for archivo in inventario.dump roles.sql metadatos.txt SHA256SUMS; do
  if [ ! -s "$carpeta_respaldo/$archivo" ] || [ -L "$carpeta_respaldo/$archivo" ]; then
    printf 'El respaldo está incompleto o el archivo no es válido: %s\n' "$archivo" >&2
    exit 1
  fi
done

# Aceptar únicamente los tres nombres del formato, sin evaluar su contenido.
declare -A archivos_respaldo=()
while IFS= read -r linea_respaldo; do
  if [[ ! "$linea_respaldo" =~ ^([a-f0-9]{64})[[:space:]][[:space:]](inventario\.dump|roles\.sql|metadatos\.txt)$ ]]; then
    printf '%s\n' 'La lista de comprobación del respaldo no es válida.' >&2
    exit 1
  fi
  archivo="${BASH_REMATCH[2]}"
  if [ -n "${archivos_respaldo[$archivo]:-}" ]; then
    printf '%s\n' 'La lista de comprobación contiene nombres repetidos.' >&2
    exit 1
  fi
  archivos_respaldo[$archivo]=1
done < "$carpeta_respaldo/SHA256SUMS"
if [ "${#archivos_respaldo[@]}" -ne 3 ]; then
  printf '%s\n' 'La lista de comprobación está incompleta.' >&2
  exit 1
fi
if ! (cd -- "$carpeta_respaldo" && sha256sum --check --status SHA256SUMS); then
  printf '%s\n' 'El contenido no coincide con su suma SHA-256. No se inició la restauración.' >&2
  exit 1
fi
for marcador in formato=1 proyecto=inventario-barrancas base=inventario postgres_major=18; do
  if ! grep -Fxq -- "$marcador" "$carpeta_respaldo/metadatos.txt"; then
    printf '%s\n' 'El respaldo no corresponde al formato esperado para este proyecto.' >&2
    exit 1
  fi
done

registro_restauracion="$(mktemp -d "${TMPDIR:-/tmp}/verificar-respaldo.XXXXXXXX")"
contenedor_restauracion=""
limpiar_restauracion() {
  codigo_salida=$?
  trap - EXIT
  if [ -n "$contenedor_restauracion" ]; then
    if ! docker rm --force --volumes "$contenedor_restauracion" \
        > "$registro_restauracion/limpieza.log" 2>&1; then
      printf 'No se pudo eliminar el contenedor temporal: %s\n' "$contenedor_restauracion" >&2
      codigo_salida=1
    fi
  fi
  if [ "$codigo_salida" -eq 0 ]; then
    rm -rf -- "$registro_restauracion"
  else
    printf 'Detalles privados de la prueba: %s\n' "$registro_restauracion" >&2
  fi
  exit "$codigo_salida"
}
trap limpiar_restauracion EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fallar_restauracion() {
  printf '%s\n' "$1" >&2
  exit 1
}

identificador_restauracion="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
clave_restauracion="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
usuario_restauracion="restaurador_${identificador_restauracion}"
nombre_restauracion="inventario-restauracion-${identificador_restauracion}"

printf '%s\n' 'Probando la recuperación en un contenedor aislado…'
if ! contenedor_restauracion="$(POSTGRES_PASSWORD="$clave_restauracion" docker run \
  --detach --rm --network none --name "$nombre_restauracion" \
  --label inventario-barrancas.funcion=prueba-restauracion \
  --env POSTGRES_DB=restauracion_control --env "POSTGRES_USER=$usuario_restauracion" \
  --env POSTGRES_PASSWORD postgres:18-bookworm \
  2> "$registro_restauracion/inicio.log")"; then
  contenedor_restauracion=""
  fallar_restauracion 'No se pudo iniciar el contenedor de prueba.'
fi
unset clave_restauracion
if [[ ! "$contenedor_restauracion" =~ ^[a-f0-9]{64}$ ]]; then
  contenedor_restauracion=""
  fallar_restauracion 'Docker no devolvió un identificador de contenedor válido.'
fi

preparado_restauracion=false
for ((intento_restauracion=0; intento_restauracion<45; intento_restauracion++)); do
  if docker exec "$contenedor_restauracion" pg_isready --host=127.0.0.1 \
      --username="$usuario_restauracion" --dbname=restauracion_control \
      > "$registro_restauracion/disponibilidad.log" 2>&1; then
    preparado_restauracion=true
    break
  fi
  sleep 1
done
if [ "$preparado_restauracion" != true ]; then
  fallar_restauracion 'PostgreSQL de prueba no quedó disponible dentro del plazo.'
fi

if ! docker exec -i "$contenedor_restauracion" psql -X --no-password \
  --username="$usuario_restauracion" --dbname=restauracion_control \
  -v ON_ERROR_STOP=1 --single-transaction -f - \
  < "$carpeta_respaldo/roles.sql" > "$registro_restauracion/roles.log" 2>&1; then
  fallar_restauracion 'No fue posible restaurar los roles de la copia.'
fi

if ! docker exec -i "$contenedor_restauracion" pg_restore --no-password \
  --username="$usuario_restauracion" --dbname=restauracion_control \
  --create --exit-on-error \
  < "$carpeta_respaldo/inventario.dump" > "$registro_restauracion/datos.log" 2>&1; then
  fallar_restauracion 'No fue posible restaurar la estructura y los datos de la copia.'
fi

if ! docker exec -i "$contenedor_restauracion" psql -X --no-password \
  --username=inventario_app --dbname=inventario -v ON_ERROR_STOP=1 \
  -v "validar_datos_ci=$validar_datos_ci" -f - \
  < "$raiz_respaldos/database/verificar-restauracion.sql" \
  > "$registro_restauracion/verificacion.log" 2>&1; then
  fallar_restauracion 'La copia no superó la verificación de datos, permisos e integridad.'
fi

if ! docker rm --force --volumes "$contenedor_restauracion" \
    > "$registro_restauracion/limpieza.log" 2>&1; then
  fallar_restauracion 'La prueba terminó, pero no fue posible eliminar su contenedor temporal.'
fi
contenedor_restauracion=""
cat -- "$registro_restauracion/verificacion.log"
printf '%s\n' 'Restauración comprobada. El contenedor de prueba y su almacenamiento temporal fueron eliminados.'
