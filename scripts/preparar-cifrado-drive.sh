#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -ne 0 ]; then
  printf '%s\n' 'Uso: bash scripts/preparar-cifrado-drive.sh' >&2
  exit 1
fi
carpeta_cifrado="${INVENTARIO_RESPALDOS_CONFIG_DIR:-$HOME/.config/inventario-respaldos}"
imagen_cifrado='rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5'
for herramienta_cifrado in docker git; do
  command -v "$herramienta_cifrado" >/dev/null || { printf 'Falta %s.\n' "$herramienta_cifrado" >&2; exit 1; }
done
if [ ! -d "$carpeta_cifrado" ] || [ -L "$carpeta_cifrado" ] \
    || [ "$(stat -c %u -- "$carpeta_cifrado")" != "$(id -u)" ] \
    || [ "$(stat -c %a -- "$carpeta_cifrado")" != 700 ]; then
  printf '%s\n' 'Se requiere la carpeta privada de configuración, con propietario actual y permisos 700.' >&2
  exit 1
fi
if [ "$(git -C "$carpeta_cifrado" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ]; then
  printf '%s\n' 'La configuración y las claves deben quedar fuera de Git.' >&2
  exit 1
fi
if ! mkdir -- "$carpeta_cifrado/.preparando-cifrado" 2>/dev/null; then
  printf '%s\n' 'Ya hay una preparación de cifrado en curso o un bloqueo pendiente de revisar.' >&2
  exit 1
fi
temporal_cifrado=""
prueba_creada=false
remoto_prueba=""

limpiar_cifrado() {
  codigo_cifrado=$?
  trap - EXIT
  if [ "$prueba_creada" = true ]; then
    # rmdir solo retira el directorio único si está vacío; nunca borra su contenido.
    if ! ejecutar_rclone_cifrado bridge /config/rclone.conf rmdir "$remoto_prueba" \
        >/dev/null 2>&1; then
      printf 'La carpeta temporal de prueba quedó conservada: %s\n' "$remoto_prueba" >&2
    fi
  fi
  if [ -n "$temporal_cifrado" ] && [ -d "$temporal_cifrado" ]; then
    if [ "$codigo_cifrado" -ne 0 ] && [ -s "$temporal_cifrado/error.log" ]; then
      registro_cifrado="$(mktemp "$carpeta_cifrado/error-cifrado.XXXXXXXX.log")"
      install -m 600 -- "$temporal_cifrado/error.log" "$registro_cifrado"
      printf 'Diagnóstico privado: %s\n' "$registro_cifrado" >&2
    fi
    rm -rf -- "$temporal_cifrado"
  fi
  rmdir -- "$carpeta_cifrado/.preparando-cifrado"
  exit "$codigo_cifrado"
}
trap limpiar_cifrado EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
temporal_cifrado="$(mktemp -d "$carpeta_cifrado/.cifrado.XXXXXXXX")"

cat > "$temporal_cifrado/configurar.mjs" <<'NODE_CIFRADO'
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const temporal = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.dirname(temporal);
const unidad = '0AFt45KLDJwTFUk9PVA';
const raizRemota = 'PostgreSQL-Cifrado';
const opcionesCrypt = {
  type: 'crypt',
  remote: `barrancas_drive:${raizRemota}`,
  filename_encryption: 'standard',
  directory_name_encryption: 'true',
  filename_encoding: 'base32',
};
const archivoLlave = path.join(carpeta, 'recuperacion-cifrado.json');

function fallar(mensaje) {
  const error = new Error(mensaje);
  error.seguro = mensaje;
  throw error;
}
function leerPrivado(nombre, limite = 1048576) {
  let fd;
  try {
    fd = fs.openSync(nombre, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const estado = fs.fstatSync(fd);
    if (!estado.isFile() || estado.uid !== process.getuid() || (estado.mode & 0o077)
        || estado.size === 0 || estado.size > limite) {
      fallar('Hay un archivo de configuración o prueba que no cumple los permisos privados esperados.');
    }
    return fs.readFileSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
function escribirPrivado(nombre, contenido) {
  fs.writeFileSync(nombre, contenido, { mode: 0o600, flag: 'wx' });
}
function existe(nombre) {
  try { fs.lstatSync(nombre); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
function opcionesValidas(crypt) {
  return crypt && typeof crypt === 'object' && !Array.isArray(crypt)
    && Object.entries(opcionesCrypt).every(([clave, valor]) => crypt[clave] === valor)
    && Object.keys(crypt).every((clave) => Object.hasOwn(opcionesCrypt, clave) || ['password', 'password2'].includes(clave))
    && ['password', 'password2'].every((clave) => typeof crypt[clave] === 'string'
      && /^[A-Za-z0-9_-]{64,512}$/.test(crypt[clave]));
}
function estadoConfiguracion() {
  const datos = JSON.parse(leerPrivado(path.join(temporal, 'estado.json')).toString('utf8'));
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)
      || Object.keys(datos).some((nombre) => !['barrancas_drive', 'barrancas_cifrado'].includes(nombre))) {
    fallar('La configuración contiene conexiones distintas de las previstas para estos respaldos.');
  }
  const drive = datos.barrancas_drive;
  const camposDrive = ['type', 'client_id', 'client_secret', 'scope', 'token', 'team_drive', 'root_folder_id'];
  if (!drive || drive.type !== 'drive' || drive.scope !== 'drive.file'
      || drive.team_drive !== unidad || drive.root_folder_id !== unidad
      || Object.keys(drive).some((campo) => !camposDrive.includes(campo))
      || typeof drive.client_id !== 'string' || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(drive.client_id)
      || typeof drive.client_secret !== 'string' || !/^[A-Za-z0-9_-]{8,512}$/.test(drive.client_secret)
      || typeof drive.token !== 'string') {
    fallar('La conexión debe usar la unidad acordada, el cliente OAuth propio y el permiso drive.file.');
  }
  const token = JSON.parse(drive.token);
  if (typeof token.access_token !== 'string' || !token.access_token
      || typeof token.refresh_token !== 'string' || !token.refresh_token) {
    fallar('La conexión todavía no tiene una autorización renovable.');
  }
  return datos;
}
function leerLlave() {
  const llave = JSON.parse(leerPrivado(archivoLlave).toString('utf8'));
  if (llave.formato !== 1 || llave.sistema !== 'inventario-barrancas'
      || llave.unidad_id !== unidad || llave.carpeta_remota !== raizRemota
      || typeof llave.id_clave !== 'string' || !/^[a-f0-9-]{36}$/.test(llave.id_clave)
      || !opcionesValidas(llave.crypt)) {
    fallar('El archivo de recuperación no corresponde al formato de cifrado esperado.');
  }
  return llave;
}
function seccion(nombre, opciones) {
  return `[${nombre}]\n` + Object.entries(opciones).map(([clave, valor]) => `${clave} = ${valor}`).join('\n') + '\n';
}

try {
  switch (process.argv[2]) {
    case 'capturar': {
      escribirPrivado(path.join(temporal, 'base.conf'), leerPrivado(path.join(carpeta, 'rclone.conf')));
      break;
    }
    case 'examinar': {
      const estado = estadoConfiguracion();
      const tieneCrypt = Object.hasOwn(estado, 'barrancas_cifrado');
      const tieneLlave = existe(archivoLlave);
      if (tieneCrypt !== tieneLlave) {
        fallar('La conexión cifrada y su archivo de recuperación están incompletos. Se conservaron para revisar su estado.');
      }
      if (tieneCrypt) {
        const llave = leerLlave();
        if (!opcionesValidas(estado.barrancas_cifrado)
            || Object.entries(llave.crypt).some(([clave, valor]) => estado.barrancas_cifrado[clave] !== valor)) {
          fallar('La conexión y el archivo de recuperación utilizan claves o ajustes diferentes.');
        }
      }
      console.log(tieneCrypt ? 'existente' : 'nuevo');
      break;
    }
    case 'generar': {
      escribirPrivado(path.join(temporal, 'clave.txt'), crypto.randomBytes(32).toString('hex') + '\n');
      escribirPrivado(path.join(temporal, 'segunda-clave.txt'), crypto.randomBytes(32).toString('hex') + '\n');
      break;
    }
    case 'activar': {
      const estado = estadoConfiguracion();
      if (estado.barrancas_cifrado || existe(archivoLlave)) fallar('Se conservaron las claves ya existentes.');
      const base = leerPrivado(path.join(temporal, 'base.conf'));
      const actual = leerPrivado(path.join(carpeta, 'rclone.conf'));
      if (!base.equals(actual)) fallar('La autorización cambió durante la preparación. No se reemplazó.');
      const crypt = { ...opcionesCrypt };
      crypt.password = leerPrivado(path.join(temporal, 'clave.obscura')).toString('utf8').trim();
      crypt.password2 = leerPrivado(path.join(temporal, 'segunda-clave.obscura')).toString('utf8').trim();
      if (!opcionesValidas(crypt)) fallar('Rclone no devolvió el formato esperado para las claves.');
      const llave = {
        formato: 1,
        sistema: 'inventario-barrancas',
        id_clave: crypto.randomUUID(),
        creado_en: new Date().toISOString(),
        unidad_id: unidad,
        carpeta_remota: raizRemota,
        crypt,
      };
      escribirPrivado(path.join(temporal, 'llave.nueva.json'), JSON.stringify(llave, null, 2) + '\n');
      escribirPrivado(path.join(temporal, 'configuracion.nueva.conf'),
        base.toString('utf8').replace(/\s*$/, '\n\n') + seccion('barrancas_cifrado', crypt));
      escribirPrivado(path.join(carpeta, `rclone-antes-cifrado.${path.basename(temporal).slice(1)}.conf`), base);
      // Publicar la llave antes de activar la conexión; nunca perder una clave ya creada.
      fs.linkSync(path.join(temporal, 'llave.nueva.json'), archivoLlave);
      fs.renameSync(path.join(temporal, 'configuracion.nueva.conf'), path.join(carpeta, 'rclone.conf'));
      console.log('Conexión cifrada y archivo privado de recuperación creados.');
      break;
    }
    case 'preparar-prueba': {
      const llave = leerLlave();
      const local = { ...llave.crypt, remote: '/trabajo/cifrado' };
      escribirPrivado(path.join(temporal, 'recuperacion.conf'), seccion('recuperacion', local));
      escribirPrivado(path.join(temporal, 'prueba.txt'),
        'Prueba técnica de cifrado y recuperación de Inventario SLEP Barrancas.\n' + crypto.randomBytes(32).toString('hex') + '\n');
      break;
    }
    case 'comparar': {
      const objetos = fs.readdirSync(path.join(temporal, 'cifrado'), { withFileTypes: true });
      if (objetos.length !== 1 || !objetos[0].isFile() || !/^[a-z0-9]{16,512}$/i.test(objetos[0].name)) {
        fallar('La prueba no produjo un único archivo con nombre cifrado.');
      }
      const cifrado = leerPrivado(path.join(temporal, 'cifrado', objetos[0].name), 65536);
      if (!cifrado.subarray(0, 8).equals(Buffer.from([82, 67, 76, 79, 78, 69, 0, 0]))) {
        fallar('El archivo descargado no tiene el encabezado de cifrado de Rclone.');
      }
      const original = leerPrivado(path.join(temporal, 'prueba.txt'), 65536);
      const recuperado = leerPrivado(path.join(temporal, 'recuperado', 'prueba.txt'), 65536);
      if (!original.equals(recuperado)) fallar('La recuperación no coincide con el archivo de prueba original.');
      console.log(objetos[0].name);
      break;
    }
    default:
      fallar('Acción de preparación no reconocida.');
  }
} catch (error) {
  console.error(error.seguro || 'No se pudo completar la preparación privada del cifrado.');
  process.exitCode = 1;
}
NODE_CIFRADO

ayudante_cifrado() {
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --volume "$carpeta_cifrado:/config:Z" \
    node:24-bookworm-slim node "/config/${temporal_cifrado##*/}/configurar.mjs" "$1"
}
ejecutar_rclone_cifrado() {
  red_cifrado="$1"
  configuracion_cifrado="$2"
  shift 2
  docker run --rm -i --network "$red_cifrado" --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --tmpfs /tmp:rw,nosuid,nodev,size=16m,mode=1777 \
    --volume "$carpeta_cifrado:/config:Z" \
    --volume "$temporal_cifrado:/trabajo:Z" \
    --entrypoint /bin/sh "$imagen_cifrado" \
    -c 'umask 077; exec rclone "$@"' sh \
    --config "$configuracion_cifrado" --cache-dir /tmp/cache --temp-dir /tmp \
    --log-level ERROR --stats 0 --contimeout 10s --timeout 45s \
    --retries 1 --low-level-retries 2 "$@"
}
operacion_cifrado() {
  descripcion_cifrado="$1"
  shift
  if ! ejecutar_rclone_cifrado "$@" \
      > "$temporal_cifrado/salida.txt" 2> "$temporal_cifrado/error.log"; then
    printf 'No se completó la operación: %s.\n' "$descripcion_cifrado" >&2
    exit 1
  fi
}

ayudante_cifrado capturar
operacion_cifrado 'leer la configuración local' none /trabajo/base.conf config dump
mv -- "$temporal_cifrado/salida.txt" "$temporal_cifrado/estado.json"
estado_cifrado="$(ayudante_cifrado examinar)"
identificador_prueba="$(date -u +%Y%m%dT%H%M%SZ)_$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
remoto_prueba="barrancas_drive:Comprobaciones/prueba_${identificador_prueba}"

printf '%s\n' 'Comprobando escritura en la unidad compartida con una carpeta temporal…'
operacion_cifrado 'crear la carpeta de prueba en Drive' bridge /config/rclone.conf mkdir "$remoto_prueba"
prueba_creada=true

if [ "$estado_cifrado" = nuevo ]; then
  # La llamada anterior puede renovar el token. Capturar otra vez antes de añadir Crypt.
  rm -- "$temporal_cifrado/base.conf" "$temporal_cifrado/estado.json"
  ayudante_cifrado capturar
  operacion_cifrado 'leer la autorización actualizada' none /trabajo/base.conf config dump
  mv -- "$temporal_cifrado/salida.txt" "$temporal_cifrado/estado.json"
  ayudante_cifrado generar
  operacion_cifrado 'preparar la primera clave' none '' obscure - < "$temporal_cifrado/clave.txt"
  mv -- "$temporal_cifrado/salida.txt" "$temporal_cifrado/clave.obscura"
  operacion_cifrado 'preparar la segunda clave' none '' obscure - < "$temporal_cifrado/segunda-clave.txt"
  mv -- "$temporal_cifrado/salida.txt" "$temporal_cifrado/segunda-clave.obscura"
  ayudante_cifrado activar
fi

ayudante_cifrado preparar-prueba
printf '%s\n' 'Subiendo un archivo ficticio con contenido y nombre cifrados…'
operacion_cifrado 'subir la prueba cifrada' bridge /config/rclone.conf \
  --crypt-remote "$remoto_prueba" copyto /trabajo/prueba.txt barrancas_cifrado:prueba.txt --immutable
operacion_cifrado 'descargar los bytes cifrados' bridge /config/rclone.conf \
  copy "$remoto_prueba" /trabajo/cifrado
printf '%s\n' 'Comprobando la recuperación local usando únicamente el archivo de claves…'
operacion_cifrado 'recuperar la prueba sin conexión a Google' none /trabajo/recuperacion.conf \
  copy recuperacion: /trabajo/recuperado
nombre_cifrado="$(ayudante_cifrado comparar)"
if [[ ! "$nombre_cifrado" =~ ^[A-Za-z0-9]{16,512}$ ]]; then
  printf '%s\n' 'El nombre del archivo de prueba no es válido para su limpieza.' >&2
  exit 1
fi
operacion_cifrado 'retirar el archivo ficticio de prueba' bridge /config/rclone.conf \
  deletefile "$remoto_prueba/$nombre_cifrado"
operacion_cifrado 'retirar la carpeta temporal vacía' bridge /config/rclone.conf \
  rmdir "$remoto_prueba"
prueba_creada=false

printf '%s\n' 'Acceso a Drive, cifrado y recuperación con la llave comprobados.'
printf 'Archivo privado de recuperación: %s/recuperacion-cifrado.json\n' "$carpeta_cifrado"
printf '%s\n' \
  'Conserva una copia de ese archivo fuera de CentOS, bajo custodia de UTIC.' \
  'Guárdalo separado de los respaldos cifrados. Contiene las claves necesarias para recuperarlos.' \
  'El siguiente paso será enviar un respaldo de PostgreSQL y comprobar su restauración desde Drive.'
