#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] \
    || { [ "$#" -eq 2 ] && [ "$2" != --datos-ci ]; }; then
  printf '%s\n' 'Uso: bash scripts/verificar-cifrado-postgresql.sh directorio_respaldo [--datos-ci]' >&2
  exit 1
fi
command -v docker >/dev/null || { printf '%s\n' 'Docker no está disponible.' >&2; exit 1; }
raiz_prueba="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
origen_prueba="$(cd -- "$1" && pwd -P)"
test -f "$raiz_prueba/scripts/verificar-respaldo-postgresql.sh"
imagen_prueba='rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5'
temporal_prueba="$(mktemp -d "${TMPDIR:-/tmp}/verificar-cifrado.XXXXXXXX")"

limpiar_prueba() {
  codigo_prueba=$?
  trap - EXIT
  if [ "$codigo_prueba" -ne 0 ] && [ -s "$temporal_prueba/error.log" ]; then
    registro_prueba="$(mktemp "${TMPDIR:-/tmp}/error-prueba-cifrado.XXXXXXXX.log")"
    install -m 600 -- "$temporal_prueba/error.log" "$registro_prueba"
    printf 'Diagnóstico privado de la prueba: %s\n' "$registro_prueba" >&2
  fi
  rm -rf -- "$temporal_prueba"
  exit "$codigo_prueba"
}
trap limpiar_prueba EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cat > "$temporal_prueba/comprobar.mjs" <<'NODE_PRUEBA'
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const trabajo = path.dirname(fileURLToPath(import.meta.url));
const nombres = ['inventario.dump', 'roles.sql', 'metadatos.txt', 'SHA256SUMS'];
const encabezado = Buffer.from([82, 67, 76, 79, 78, 69, 0, 0]);

function exigir(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}
function leerPrivado(archivo) {
  const fd = fs.openSync(archivo, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const estado = fs.fstatSync(fd);
    exigir(estado.isFile() && estado.uid === process.getuid()
      && !(estado.mode & 0o077) && estado.size > 0, 'Archivo de prueba no válido.');
    exigir(estado.size <= 65536, 'Archivo de configuración demasiado grande.');
    return fs.readFileSync(fd).toString('utf8').trim();
  } finally { fs.closeSync(fd); }
}
function escribir(archivo, contenido) {
  fs.writeFileSync(path.join(trabajo, archivo), contenido, { mode: 0o600, flag: 'wx' });
}
function comprobarCarpeta(directorio) {
  const estado = fs.lstatSync(directorio);
  exigir(estado.isDirectory() && estado.uid === process.getuid() && !(estado.mode & 0o077),
    'La carpeta del respaldo debe ser privada.');
  exigir(JSON.stringify(fs.readdirSync(directorio).sort()) === JSON.stringify([...nombres].sort()),
    'La prueba acepta exactamente los cuatro archivos del respaldo.');
  for (const nombre of nombres) {
    const archivo = fs.lstatSync(path.join(directorio, nombre));
    exigir(archivo.isFile() && archivo.uid === process.getuid()
      && !(archivo.mode & 0o077) && archivo.size > 0, 'El respaldo contiene un archivo no válido.');
  }
}
function configuracion(nombre, password, password2) {
  return `[${nombre}]\ntype = crypt\nremote = ${trabajo}/cifrado\n`
    + 'filename_encryption = standard\ndirectory_name_encryption = true\nfilename_encoding = base32\n'
    + `password = ${password}\npassword2 = ${password2}\n`;
}

try {
  switch (process.argv[2]) {
    case 'preparar':
      comprobarCarpeta(process.argv[3]);
      escribir('archivos.txt', nombres.join('\n') + '\n');
      for (const nombre of ['clave', 'sal', 'incorrecta']) {
        escribir(`${nombre}.txt`, crypto.randomBytes(32).toString('hex') + '\n');
      }
      break;
    case 'configurar': {
      const clave = leerPrivado(path.join(trabajo, 'clave.obscura'));
      const sal = leerPrivado(path.join(trabajo, 'sal.obscura'));
      const incorrecta = leerPrivado(path.join(trabajo, 'incorrecta.obscura'));
      exigir([clave, sal, incorrecta].every((valor) => /^[A-Za-z0-9_-]{64,512}$/.test(valor)),
        'Rclone no preparó las claves de prueba.');
      escribir('cifrar.conf', configuracion('prueba', clave, sal));
      escribir('recuperar.conf', configuracion('prueba', clave, sal));
      escribir('incorrecta.conf', configuracion('prueba', incorrecta, sal));
      for (const nombre of ['clave', 'sal', 'incorrecta']) fs.unlinkSync(path.join(trabajo, `${nombre}.txt`));
      break;
    }
    case 'examinar-cifrado': {
      const directorio = path.join(trabajo, 'cifrado');
      const objetos = fs.readdirSync(directorio, { withFileTypes: true });
      exigir(objetos.length === nombres.length, 'El cifrado no contiene los cuatro archivos.');
      const alterados = path.join(trabajo, 'alterado');
      fs.mkdirSync(alterados, { mode: 0o700 });
      for (const objeto of objetos) {
        exigir(objeto.isFile() && /^[a-z0-9]{16,512}$/i.test(objeto.name),
          'Un archivo no tiene el nombre cifrado esperado.');
        const original = path.join(directorio, objeto.name);
        const fd = fs.openSync(original, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          const bytes = Buffer.alloc(8);
          exigir(fs.readSync(fd, bytes, 0, 8, 0) === 8 && bytes.equals(encabezado),
            'Un archivo no tiene el encabezado de cifrado esperado.');
        } finally { fs.closeSync(fd); }
        const copia = path.join(alterados, objeto.name);
        fs.copyFileSync(original, copia, fs.constants.COPYFILE_EXCL);
        const alterado = fs.openSync(copia, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
        try {
          const estado = fs.fstatSync(alterado);
          exigir(estado.size > 48, 'Un archivo cifrado está incompleto.');
          const byte = Buffer.alloc(1);
          fs.readSync(alterado, byte, 0, 1, estado.size - 1);
          byte[0] ^= 1;
          fs.writeSync(alterado, byte, 0, 1, estado.size - 1);
        } finally { fs.closeSync(alterado); }
      }
      break;
    }
    case 'recuperado':
      comprobarCarpeta(path.join(trabajo, 'recuperado'));
      break;
    default:
      throw new Error('Acción de prueba no válida.');
  }
} catch (error) {
  // Los detalles de archivos se conservan en el registro privado del contenedor.
  console.error(error.message);
  process.exitCode = 1;
}
NODE_PRUEBA

ayudante_prueba() {
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --volume "$temporal_prueba:/prueba:Z" --volume "$origen_prueba:/origen:ro,Z" \
    node:24-bookworm-slim node /prueba/comprobar.mjs "$1" /origen
}
rclone_prueba() {
  configuracion_prueba="$1"
  shift
  docker run --rm --interactive --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges --user "$(id -u):$(id -g)" \
    --tmpfs /tmp:rw,nosuid,nodev,size=32m,mode=1777 \
    --volume "$temporal_prueba:/prueba:Z" --volume "$origen_prueba:/origen:ro,Z" \
    --entrypoint /bin/sh "$imagen_prueba" -c 'umask 077; exec rclone "$@"' sh \
    --config "/prueba/$configuracion_prueba" --cache-dir /tmp/cache --temp-dir /tmp \
    --log-level ERROR --stats 0 --retries 1 --low-level-retries 1 "$@"
}
operacion_prueba() {
  if ! "$@" > "$temporal_prueba/salida.log" 2> "$temporal_prueba/error.log"; then
    printf '%s\n' 'Falló una operación de la prueba de cifrado local.' >&2
    exit 1
  fi
}

printf '%s\n' 'Probando el cifrado con claves temporales y contenedores sin red…'
operacion_prueba ayudante_prueba preparar
for parte_prueba in clave sal incorrecta; do
  if ! rclone_prueba no-utilizada.conf obscure - < "$temporal_prueba/$parte_prueba.txt" \
      > "$temporal_prueba/$parte_prueba.obscura" 2> "$temporal_prueba/error.log"; then
    printf '%s\n' 'No se pudieron preparar las claves de prueba.' >&2
    exit 1
  fi
done
operacion_prueba ayudante_prueba configurar
operacion_prueba rclone_prueba cifrar.conf copy /origen prueba: \
  --files-from /prueba/archivos.txt --immutable
operacion_prueba ayudante_prueba examinar-cifrado

if rclone_prueba incorrecta.conf copyto prueba:inventario.dump /prueba/clave-incorrecta.dump \
    > "$temporal_prueba/salida.log" 2> "$temporal_prueba/error.log"; then
  printf '%s\n' 'La prueba no rechazó una clave incorrecta.' >&2
  exit 1
fi
if rclone_prueba recuperar.conf copyto prueba:inventario.dump /prueba/alterado.dump \
    --crypt-remote /prueba/alterado \
    > "$temporal_prueba/salida.log" 2> "$temporal_prueba/error.log"; then
  printf '%s\n' 'La prueba no rechazó un archivo cifrado alterado.' >&2
  exit 1
fi
operacion_prueba rclone_prueba recuperar.conf copy prueba: /prueba/recuperado \
  --files-from /prueba/archivos.txt
operacion_prueba ayudante_prueba recuperado
for archivo_prueba in inventario.dump roles.sql metadatos.txt SHA256SUMS; do
  if ! cmp --silent -- "$origen_prueba/$archivo_prueba" "$temporal_prueba/recuperado/$archivo_prueba"; then
    printf '%s\n' 'Los datos recuperados no coinciden con el respaldo original.' >&2
    exit 1
  fi
done
argumentos_prueba=("$temporal_prueba/recuperado")
if [ "${2:-}" = --datos-ci ]; then argumentos_prueba+=(--datos-ci); fi
bash "$raiz_prueba/scripts/verificar-respaldo-postgresql.sh" "${argumentos_prueba[@]}"
printf '%s\n' 'Cifrado, rechazo de claves incorrectas y datos alterados, y restauración comprobados.'
