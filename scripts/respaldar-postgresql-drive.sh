#!/usr/bin/env bash
set -euo pipefail
umask 077

modo_envio=nuevo
identificador_envio=""
if [ "$#" -eq 2 ] && [ "$1" = --verificar ]; then
  modo_envio=verificar
  identificador_envio="$2"
elif [ "$#" -ne 0 ]; then
  printf '%s\n' 'Uso: bash scripts/respaldar-postgresql-drive.sh [--verificar identificador_respaldo]' >&2
  exit 1
fi
if [ "$modo_envio" = verificar ] \
    && [[ ! "$identificador_envio" =~ ^inventario_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{32}$ ]]; then
  printf '%s\n' 'El identificador del respaldo no tiene el formato esperado.' >&2
  exit 1
fi
raiz_envio="$(git rev-parse --show-toplevel)"
cd -- "$raiz_envio"
for requerido_envio in scripts/respaldar-postgresql.sh scripts/verificar-respaldo-postgresql.sh database/verificar-restauracion.sql; do
  test -f "$requerido_envio" || { printf 'Falta %s.\n' "$requerido_envio" >&2; exit 1; }
done
command -v docker >/dev/null || { printf '%s\n' 'Docker no está disponible.' >&2; exit 1; }
carpeta_envio="${INVENTARIO_RESPALDOS_CONFIG_DIR:-$HOME/.config/inventario-respaldos}"
imagen_envio='rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5'
if [ ! -d "$carpeta_envio" ] || [ -L "$carpeta_envio" ] \
    || [ "$(stat -c %u -- "$carpeta_envio")" != "$(id -u)" ] \
    || [ "$(stat -c %a -- "$carpeta_envio")" != 700 ]; then
  printf '%s\n' 'La configuración de Drive debe tener propietario actual y permisos privados 700.' >&2
  exit 1
fi
if [ "$(git -C "$carpeta_envio" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ]; then
  printf '%s\n' 'La configuración y las claves deben permanecer fuera de Git.' >&2
  exit 1
fi
if [ ! -f "$carpeta_envio/rclone.conf" ] || [ -L "$carpeta_envio/rclone.conf" ] \
    || [ "$(stat -c %u -- "$carpeta_envio/rclone.conf")" != "$(id -u)" ] \
    || [ "$(stat -c %a -- "$carpeta_envio/rclone.conf")" != 600 ]; then
  printf '%s\n' 'La configuración de Rclone debe ser un archivo privado con permisos 600.' >&2
  exit 1
fi
if ! mkdir -- "$carpeta_envio/.enviando-respaldo" 2>/dev/null; then
  printf '%s\n' 'Hay un envío o verificación de Drive en curso, o un bloqueo pendiente de revisar.' >&2
  exit 1
fi
temporal_envio=""
temporal_constancia=""
origen_envio=""
limpiar_envio() {
  codigo_envio=$?
  trap - EXIT
  if [ -n "$temporal_envio" ] && [ -d "$temporal_envio" ]; then
    if [ "$codigo_envio" -ne 0 ]; then
      registro_envio="$(mktemp -d "$carpeta_envio/error-envio.XXXXXXXX")"
      for archivo_registro in error.log restauracion.log; do
        if [ -f "$temporal_envio/$archivo_registro" ]; then
          install -m 600 -- "$temporal_envio/$archivo_registro" "$registro_envio/$archivo_registro"
        fi
      done
      printf 'Diagnóstico privado: %s\n' "$registro_envio" >&2
      printf '%s\n' 'Se conservaron las copias locales y los archivos ya enviados a Drive.' >&2
    fi
    rm -rf -- "$temporal_envio"
  fi
  if [ -n "$temporal_constancia" ] && [ -f "$temporal_constancia" ]; then rm -- "$temporal_constancia"; fi
  rmdir -- "$carpeta_envio/.enviando-respaldo"
  exit "$codigo_envio"
}
trap limpiar_envio EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
temporal_envio="$(mktemp -d "$carpeta_envio/.envio.XXXXXXXX")"

cat > "$temporal_envio/comprobar.mjs" <<'NODE_ENVIO'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const trabajo = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.dirname(trabajo);
const nombres = ['inventario.dump', 'roles.sql', 'metadatos.txt', 'SHA256SUMS'];
const identificador = process.argv[3];

function fallar(mensaje) {
  const error = new Error(mensaje);
  error.seguro = mensaje;
  throw error;
}
function abrirPrivado(nombre, limite) {
  const fd = fs.openSync(nombre, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const estado = fs.fstatSync(fd);
    if (!estado.isFile() || estado.uid !== process.getuid() || (estado.mode & 0o077)
        || estado.size === 0 || !Number.isSafeInteger(estado.size)
        || (limite && estado.size > limite)) {
      fallar('Un archivo no cumple el formato o los permisos privados esperados.');
    }
    return { fd, bytes: estado.size };
  } catch (error) {
    fs.closeSync(fd);
    throw error;
  }
}
function leer(nombre, limite = 1048576) {
  const { fd } = abrirPrivado(nombre, limite);
  try { return fs.readFileSync(fd); } finally { fs.closeSync(fd); }
}
function json(nombre) { return JSON.parse(leer(nombre).toString('utf8')); }
function escribir(nombre, datos) {
  fs.writeFileSync(nombre, datos, { mode: 0o600, flag: 'wx' });
}
async function huella(nombre) {
  const { fd, bytes } = abrirPrivado(nombre);
  const hash = crypto.createHash('sha256');
  for await (const parte of fs.createReadStream(null, { fd, autoClose: true })) hash.update(parte);
  return { bytes, sha256: hash.digest('hex') };
}
function verificarIdentificador() {
  if (!/^inventario_[0-9]{8}T[0-9]{6}Z_[a-f0-9]{32}$/.test(identificador || '')) {
    fallar('El identificador de la copia no es válido.');
  }
}
function llaveActual() {
  const llave = json(path.join(carpeta, 'recuperacion-cifrado.json'));
  if (llave.formato !== 1 || llave.sistema !== 'inventario-barrancas'
      || llave.unidad_id !== '0AFt45KLDJwTFUk9PVA' || llave.carpeta_remota !== 'PostgreSQL-Cifrado'
      || typeof llave.id_clave !== 'string' || !/^[a-f0-9-]{36}$/.test(llave.id_clave)) {
    fallar('El archivo de recuperación no corresponde al sistema y la unidad previstos.');
  }
  return llave;
}
function validarMarcador(marcador) {
  verificarIdentificador();
  if (marcador.formato !== 1 || marcador.sistema !== 'inventario-barrancas'
      || marcador.postgres_major !== 18 || marcador.id_respaldo !== identificador
      || marcador.id_clave !== llaveActual().id_clave
      || marcador.verificacion !== 'restauracion_postgresql18'
      || !Number.isFinite(Date.parse(marcador.verificado_en))
      || !Array.isArray(marcador.archivos) || marcador.archivos.length !== nombres.length) {
    fallar('El marcador de finalización del respaldo no es válido o corresponde a otras claves.');
  }
  const vistos = new Set();
  for (const archivo of marcador.archivos) {
    if (!nombres.includes(archivo.nombre) || vistos.has(archivo.nombre)
        || !Number.isSafeInteger(archivo.bytes) || archivo.bytes <= 0
        || !/^[a-f0-9]{64}$/.test(archivo.sha256 || '')) {
      fallar('La lista de archivos del respaldo no es válida.');
    }
    vistos.add(archivo.nombre);
  }
  return marcador;
}
async function comprobarDatos(directorio) {
  const estado = fs.lstatSync(directorio);
  if (!estado.isDirectory() || estado.uid !== process.getuid() || (estado.mode & 0o077)) {
    fallar('La carpeta de datos debe ser privada y pertenecer al usuario actual.');
  }
  const presentes = fs.readdirSync(directorio).sort();
  if (JSON.stringify(presentes) !== JSON.stringify([...nombres].sort())) {
    fallar('La copia debe contener exactamente los cuatro archivos del formato PostgreSQL.');
  }
  const suma = leer(path.join(directorio, 'SHA256SUMS'), 65536).toString('utf8');
  const lineas = suma.endsWith('\n') ? suma.slice(0, -1).split('\n') : [];
  const esperadas = new Map();
  for (const linea of lineas) {
    const partes = /^([a-f0-9]{64})  (inventario\.dump|roles\.sql|metadatos\.txt)$/.exec(linea);
    if (!partes || esperadas.has(partes[2])) fallar('La lista SHA-256 no es válida.');
    esperadas.set(partes[2], partes[1]);
  }
  if (esperadas.size !== 3) fallar('La lista SHA-256 está incompleta.');
  const metadatos = leer(path.join(directorio, 'metadatos.txt'), 65536).toString('utf8').split('\n');
  if (!['formato=1', 'proyecto=inventario-barrancas', 'base=inventario', 'postgres_major=18']
      .every((valor) => metadatos.includes(valor))) fallar('La copia no corresponde al formato esperado.');
  const archivos = [];
  for (const nombre of nombres) {
    const datos = await huella(path.join(directorio, nombre));
    if (nombre !== 'SHA256SUMS' && datos.sha256 !== esperadas.get(nombre)) {
      fallar('La suma SHA-256 no coincide con los datos de la copia.');
    }
    archivos.push({ nombre, ...datos });
  }
  return archivos;
}

try {
  switch (process.argv[2]) {
    case 'configuracion': {
      const estado = json(path.join(trabajo, 'estado.json'));
      const llave = llaveActual();
      const drive = estado.barrancas_drive;
      const crypt = estado.barrancas_cifrado;
      const camposDrive = ['type', 'client_id', 'client_secret', 'scope', 'token', 'team_drive', 'root_folder_id'];
      const ajustes = { type: 'crypt', remote: 'barrancas_drive:PostgreSQL-Cifrado',
        filename_encryption: 'standard', directory_name_encryption: 'true', filename_encoding: 'base32' };
      const claves = [...Object.keys(ajustes), 'password', 'password2'];
      if (Object.keys(estado).some((nombre) => !['barrancas_drive', 'barrancas_cifrado'].includes(nombre))
          || !drive || drive.type !== 'drive' || drive.scope !== 'drive.file'
          || drive.team_drive !== llave.unidad_id || drive.root_folder_id !== llave.unidad_id
          || Object.keys(drive).some((clave) => !camposDrive.includes(clave))
          || typeof drive.client_id !== 'string' || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(drive.client_id)
          || typeof drive.client_secret !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(drive.client_secret)
          || !crypt || Object.keys(crypt).length !== claves.length
          || claves.some((clave) => !Object.hasOwn(crypt, clave) || crypt[clave] !== llave.crypt?.[clave])
          || Object.entries(ajustes).some(([clave, valor]) => crypt[clave] !== valor)
          || ['password', 'password2'].some((clave) => !/^[A-Za-z0-9_-]{64,512}$/.test(crypt[clave] || ''))) {
        fallar('La autorización, el destino o las claves de cifrado no coinciden con la configuración prevista.');
      }
      const token = JSON.parse(drive.token);
      if (!token.access_token || !token.refresh_token) fallar('Falta la autorización renovable de Google.');
      escribir(path.join(trabajo, 'archivos.txt'), nombres.join('\n') + '\n');
      break;
    }
    case 'origen': {
      verificarIdentificador();
      const archivos = await comprobarDatos(process.argv[4]);
      escribir(path.join(trabajo, 'esperado.json'), JSON.stringify({ archivos }) + '\n');
      break;
    }
    case 'marcador': {
      const marcador = validarMarcador(json(path.join(trabajo, 'marcador.json')));
      escribir(path.join(trabajo, 'esperado.json'), JSON.stringify({ archivos: marcador.archivos }) + '\n');
      break;
    }
    case 'descargado': {
      const archivos = await comprobarDatos(path.join(trabajo, 'recuperado'));
      const esperado = json(path.join(trabajo, 'esperado.json')).archivos;
      if (!Array.isArray(esperado) || esperado.length !== nombres.length
          || archivos.some((archivo) => {
            const referencia = esperado.find((valor) => valor.nombre === archivo.nombre);
            return !referencia || referencia.bytes !== archivo.bytes || referencia.sha256 !== archivo.sha256;
          })) fallar('La copia descargada de Drive difiere del respaldo esperado.');
      break;
    }
    case 'publicar': {
      verificarIdentificador();
      const marcador = { formato: 1, sistema: 'inventario-barrancas', postgres_major: 18,
        id_respaldo: identificador, id_clave: llaveActual().id_clave,
        verificacion: 'restauracion_postgresql18', verificado_en: new Date().toISOString(),
        archivos: json(path.join(trabajo, 'esperado.json')).archivos };
      validarMarcador(marcador);
      fs.mkdirSync(path.join(trabajo, 'publicacion'), { mode: 0o700 });
      escribir(path.join(trabajo, 'publicacion', 'COMPLETO.json'), JSON.stringify(marcador, null, 2) + '\n');
      break;
    }
    case 'confirmar-marcador': {
      const local = leer(path.join(trabajo, 'publicacion', 'COMPLETO.json'));
      const remoto = leer(path.join(trabajo, 'marcador.json'));
      if (!local.equals(remoto)) fallar('El marcador descargado de Drive no coincide con el publicado.');
      validarMarcador(JSON.parse(remoto.toString('utf8')));
      break;
    }
    case 'constancia': {
      const marcador = validarMarcador(json(path.join(trabajo, 'marcador.json')));
      const constancia = { ...marcador, comprobado_en: new Date().toISOString(),
        origen: 'google_drive', conexion: 'barrancas_cifrado', ruta: `barrancas_cifrado:${identificador}` };
      escribir(path.join(trabajo, 'constancia.json'), JSON.stringify(constancia, null, 2) + '\n');
      break;
    }
    default:
      fallar('Acción de comprobación no reconocida.');
  }
} catch (error) {
  console.error(error.seguro || 'No se pudo comprobar un archivo privado de la operación.');
  process.exitCode = 1;
}
NODE_ENVIO

ayudante_envio() {
  montajes_envio=()
  if [ -n "$origen_envio" ]; then montajes_envio=(--volume "$origen_envio:/origen:ro,Z"); fi
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --volume "$carpeta_envio:/config:Z" "${montajes_envio[@]}" \
    node:24-bookworm-slim node "/config/${temporal_envio##*/}/comprobar.mjs" \
    "$1" "$identificador_envio" "${2:-}"
}
rclone_envio() {
  red_envio="$1"
  shift
  montajes_envio=()
  if [ -n "$origen_envio" ]; then montajes_envio=(--volume "$origen_envio:/origen:ro,Z"); fi
  docker run --rm --network "$red_envio" --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --tmpfs /tmp:rw,nosuid,nodev,size=32m,mode=1777 \
    --volume "$carpeta_envio:/config:Z" \
    --volume "$temporal_envio:/trabajo:Z" "${montajes_envio[@]}" \
    --entrypoint /bin/sh "$imagen_envio" -c 'umask 077; exec rclone "$@"' sh \
    --config /config/rclone.conf --cache-dir /tmp/cache --temp-dir /tmp \
    --log-level ERROR --stats 0 --contimeout 10s --timeout 120s \
    --retries 2 --low-level-retries 3 "$@"
}
operacion_envio() {
  etapa_envio="$1"
  shift
  if ! rclone_envio "$@" > "$temporal_envio/salida.txt" 2> "$temporal_envio/error.log"; then
    printf 'No se completó la operación: %s.\n' "$etapa_envio" >&2
    exit 1
  fi
}

# El volcado de configuración contiene secretos y se conserva solo de forma temporal.
operacion_envio 'leer la configuración de cifrado' none config dump
mv -- "$temporal_envio/salida.txt" "$temporal_envio/estado.json"
ayudante_envio configuracion

if [ "$modo_envio" = nuevo ]; then
  identificador_envio="inventario_$(date -u +%Y%m%dT%H%M%SZ)_$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
  origen_envio="$(bash "$raiz_envio/scripts/respaldar-postgresql.sh")"
  origen_envio="$(cd -- "$origen_envio" && pwd -P)"
  ayudante_envio origen /origen
  printf 'Subiendo el respaldo cifrado: %s\n' "$identificador_envio" >&2
  operacion_envio 'subir los cuatro archivos cifrados' bridge copy \
    /origen "barrancas_cifrado:$identificador_envio" \
    --files-from /trabajo/archivos.txt --immutable
else
  printf 'Consultando la copia terminada: %s\n' "$identificador_envio" >&2
  operacion_envio 'descargar el marcador de finalización' bridge copyto \
    "barrancas_cifrado:$identificador_envio/COMPLETO.json" /trabajo/marcador.json
  ayudante_envio marcador
fi

printf '%s\n' 'Descargando la copia desde Drive y comprobando sus sumas SHA-256…' >&2
operacion_envio 'descargar los cuatro archivos del respaldo' bridge copy \
  "barrancas_cifrado:$identificador_envio" /trabajo/recuperado \
  --files-from /trabajo/archivos.txt
ayudante_envio descargado
if ! bash "$raiz_envio/scripts/verificar-respaldo-postgresql.sh" "$temporal_envio/recuperado" \
    > "$temporal_envio/restauracion.log"; then
  printf '%s\n' 'La copia descargada no superó la restauración de PostgreSQL. No se publicó como terminada.' >&2
  exit 1
fi
cat -- "$temporal_envio/restauracion.log" >&2

if [ "$modo_envio" = nuevo ]; then
  ayudante_envio publicar
  operacion_envio 'publicar el marcador de copia comprobada' bridge copyto \
    /trabajo/publicacion/COMPLETO.json "barrancas_cifrado:$identificador_envio/COMPLETO.json" --immutable
  operacion_envio 'comprobar el marcador publicado' bridge copyto \
    "barrancas_cifrado:$identificador_envio/COMPLETO.json" /trabajo/marcador.json
  ayudante_envio confirmar-marcador
fi
ayudante_envio constancia
destino_constancia="$raiz_envio/backups/drive"
mkdir -p -- "$destino_constancia"
if [ -L "$destino_constancia" ] || [ "$(stat -c %u -- "$destino_constancia")" != "$(id -u)" ]; then
  printf '%s\n' 'El directorio de constancias no pertenece al usuario actual o es un enlace.' >&2
  exit 1
fi
chmod 700 -- "$destino_constancia"
if ! git check-ignore --quiet -- "$destino_constancia/comprobar-exclusion"; then
  printf '%s\n' 'Las constancias deben quedar fuera del seguimiento de Git.' >&2
  exit 1
fi
nombre_constancia="$identificador_envio.json"
if [ "$modo_envio" = verificar ]; then
  nombre_constancia="verificacion_${identificador_envio}_$(date -u +%Y%m%dT%H%M%SZ)_${temporal_envio##*.}.json"
fi
constancia_envio="$destino_constancia/$nombre_constancia"
temporal_constancia="$(mktemp "$destino_constancia/.constancia.XXXXXXXX")"
install -m 600 -- "$temporal_envio/constancia.json" "$temporal_constancia"
if ! ln -- "$temporal_constancia" "$constancia_envio" 2>/dev/null; then
  printf '%s\n' 'No se pudo guardar una constancia nueva sin reemplazar otra existente.' >&2
  exit 1
fi
rm -- "$temporal_constancia"
temporal_constancia=""
printf '%s\n' 'Respaldo cifrado en Drive y restauración de PostgreSQL comprobados.' >&2
printf 'Identificador de la copia: %s\n' "$identificador_envio" >&2
printf 'Constancia local: %s\n' "$constancia_envio" >&2
printf '%s\n' "$constancia_envio"
