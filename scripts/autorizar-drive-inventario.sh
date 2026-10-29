#!/usr/bin/env bash
set -euo pipefail
umask 077

accion_drive="${1:-preparar}"
if [ "$#" -gt 1 ] || [[ "$accion_drive" != preparar && "$accion_drive" != autorizar ]]; then
  printf '%s\n' 'Uso: bash scripts/autorizar-drive-inventario.sh [preparar|autorizar]' >&2
  exit 1
fi

carpeta_drive="${INVENTARIO_RESPALDOS_CONFIG_DIR:-$HOME/.config/inventario-respaldos}"
imagen_drive='rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5'
command -v docker >/dev/null || { printf '%s\n' 'Docker no está disponible.' >&2; exit 1; }
command -v git >/dev/null || { printf '%s\n' 'Git no está disponible.' >&2; exit 1; }
if [ ! -d "$carpeta_drive" ] || [ -L "$carpeta_drive" ]; then
  printf '%s\n' 'Falta la carpeta privada ~/.config/inventario-respaldos.' >&2
  exit 1
fi
if [ "$(git -C "$carpeta_drive" rev-parse --is-inside-work-tree 2>/dev/null || true)" = true ]; then
  printf '%s\n' 'Las credenciales deben guardarse fuera de cualquier repositorio Git.' >&2
  exit 1
fi
if [ "$(stat -c %u -- "$carpeta_drive")" != "$(id -u)" ] \
    || [ "$(stat -c %a -- "$carpeta_drive")" != 700 ]; then
  printf '%s\n' 'La carpeta de configuración debe pertenecer al usuario actual y tener permisos 700.' >&2
  exit 1
fi
if [ "$accion_drive" = autorizar ] \
    && { [ -e "$carpeta_drive/rclone.conf" ] || [ -L "$carpeta_drive/rclone.conf" ]; }; then
  printf '%s\n' 'Ya existe rclone.conf. Se conservó la configuración; revisemos su estado antes de volver a autorizar.' >&2
  exit 1
fi

temporal_drive="$(mktemp -d "$carpeta_drive/.autorizacion.XXXXXXXX")"
contenedor_oauth=""
proceso_oauth=""
limpiar_drive() {
  codigo_drive=$?
  trap - EXIT
  if [ -f "$temporal_drive/contenedor.id" ]; then
    read -r contenedor_oauth < "$temporal_drive/contenedor.id" || true
    if [[ "$contenedor_oauth" =~ ^[a-f0-9]{64}$ ]] \
        && docker container inspect "$contenedor_oauth" >/dev/null 2>&1; then
      if ! docker rm --force "$contenedor_oauth" >/dev/null 2>&1; then
        printf 'No se pudo cerrar el contenedor temporal de autorización: %s\n' "$contenedor_oauth" >&2
        codigo_drive=1
      fi
    fi
  fi
  if [ -n "$proceso_oauth" ]; then wait "$proceso_oauth" 2>/dev/null || true; fi
  if [ "$codigo_drive" -ne 0 ] && [ -s "$temporal_drive/oauth.log" ]; then
    registro_error_drive="$(mktemp "$carpeta_drive/error-oauth.XXXXXXXX.log")"
    install -m 600 -- "$temporal_drive/oauth.log" "$registro_error_drive"
    printf 'Diagnóstico privado: %s\n' "$registro_error_drive" >&2
  fi
  rm -rf -- "$temporal_drive"
  exit "$codigo_drive"
}
trap limpiar_drive EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Este ayudante solo lee las credenciales locales y escribe archivos privados.
# No utiliza dependencias npm ni muestra el JSON, el secreto o los tokens.
cat > "$temporal_drive/configurar.mjs" <<'NODE_DRIVE'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const temporal = path.dirname(fileURLToPath(import.meta.url));
const carpeta = path.dirname(temporal);
const accion = process.argv[2];
const destinoUnidad = '0AFt45KLDJwTFUk9PVA';

function fallar(mensaje) {
  const error = new Error(mensaje);
  error.mensajeSeguro = mensaje;
  throw error;
}

function leerPrivado(nombre, limite) {
  let descriptor;
  try {
    descriptor = fs.openSync(nombre, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const estado = fs.fstatSync(descriptor);
    if (!estado.isFile() || estado.size === 0 || estado.size > limite
        || estado.uid !== process.getuid() || (estado.mode & 0o077) !== 0) {
      fallar('El archivo de credenciales o de autorización no tiene el formato o los permisos privados esperados.');
    }
    return fs.readFileSync(descriptor, 'utf8').replace(/^\uFEFF/, '');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function leerCliente() {
  let contenido;
  try {
    contenido = JSON.parse(leerPrivado(path.join(carpeta, 'oauth-cliente.json'), 65536));
  } catch (error) {
    if (error.mensajeSeguro) throw error;
    fallar('No se pudo leer el JSON privado del cliente OAuth.');
  }
  const cliente = contenido?.installed;
  if (!cliente || typeof cliente !== 'object' || Array.isArray(cliente)
      || typeof cliente.client_id !== 'string'
      || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(cliente.client_id)
      || typeof cliente.client_secret !== 'string'
      || !/^[A-Za-z0-9_-]{8,512}$/.test(cliente.client_secret)
      || !Array.isArray(cliente.redirect_uris)
      || !cliente.redirect_uris.some((valor) => valor === 'http://localhost' || valor === 'http://localhost/')) {
    fallar('El JSON debe corresponder al cliente OAuth de tipo App de escritorio descargado desde Google.');
  }
  return cliente;
}

try {
  const cliente = leerCliente();
  if (accion === 'validar') {
    console.log('Cliente OAuth de escritorio validado. Las credenciales no se imprimieron.');
  } else if (accion === 'entorno') {
    fs.writeFileSync(path.join(temporal, 'credenciales.env'),
      `RCLONE_DRIVE_CLIENT_ID=${cliente.client_id}\nRCLONE_DRIVE_CLIENT_SECRET=${cliente.client_secret}\n`,
      { mode: 0o600, flag: 'wx' });
  } else if (accion === 'revisar') {
    let enlace;
    for (let intento = 0; intento < 60; intento++) {
      let registro = '';
      try { registro = leerPrivado(path.join(temporal, 'oauth.log'), 1048576); } catch {}
      enlace = registro.match(/http:\/\/(?:127\.0\.0\.1|localhost):53682\/auth\?[^\s]+/)?.[0];
      if (enlace) break;
      await new Promise((resolver) => setTimeout(resolver, 250));
    }
    if (!enlace) fallar('No se inició el servidor local de autorización.');
    const local = new URL(enlace);
    local.hostname = '127.0.0.1';
    // Leer solo la redirección local. Nunca seguirla automáticamente a Google.
    let respuesta;
    for (let intento = 0; intento < 12; intento++) {
      try {
        respuesta = await fetch(local, { redirect: 'manual', signal: AbortSignal.timeout(1000) });
        break;
      } catch {
        await new Promise((resolver) => setTimeout(resolver, 250));
      }
    }
    if (!respuesta) fallar('No se pudo acceder al servidor OAuth local de CentOS.');
    if (![302, 303, 307, 308].includes(respuesta.status)) {
      fallar('El servidor local no devolvió la redirección OAuth esperada.');
    }
    const proveedor = new URL(respuesta.headers.get('location') || '');
    const permisos = (proveedor.searchParams.get('scope') || '').trim().split(/\s+/);
    const retorno = new URL(proveedor.searchParams.get('redirect_uri') || '');
    if (proveedor.protocol !== 'https:' || proveedor.hostname !== 'accounts.google.com'
        || proveedor.searchParams.get('client_id') !== cliente.client_id
        || permisos.length !== 1 || permisos[0] !== 'https://www.googleapis.com/auth/drive.file'
        || retorno.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(retorno.hostname)
        || retorno.port !== '53682') {
      fallar('La autorización no utiliza el cliente, el permiso limitado o el retorno local esperados.');
    }
    console.log('Cliente institucional y permiso drive.file comprobados antes de abrir Google.');
    console.log(`Abre este enlace en el navegador de tu computador:\n${local.href}`);
    console.log('Elige la cuenta institucional que tiene acceso a la unidad de respaldos.');
  } else if (accion === 'guardar') {
    const salida = leerPrivado(path.join(temporal, 'respuesta-oauth.txt'), 1048576);
    const inicio = salida.indexOf('{');
    const fin = salida.lastIndexOf('}');
    if (inicio < 0 || fin < inicio) fallar('Google no devolvió una autorización reconocible.');
    let token;
    try {
      token = JSON.parse(salida.slice(inicio, fin + 1));
    } catch {
      fallar('La respuesta de autorización no tiene el formato esperado.');
    }
    if (!token || typeof token !== 'object' || Array.isArray(token)
        || typeof token.access_token !== 'string' || !token.access_token.trim()
        || typeof token.refresh_token !== 'string' || !token.refresh_token.trim()
        || typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer'
        || typeof token.expiry !== 'string' || !Number.isFinite(Date.parse(token.expiry))
        || Date.parse(token.expiry) <= Date.now()) {
      fallar('Falta un token válido o renovable. Se conservó la configuración anterior.');
    }
    const configuracion = [
      '[barrancas_drive]',
      'type = drive',
      `client_id = ${cliente.client_id}`,
      `client_secret = ${cliente.client_secret}`,
      'scope = drive.file',
      `token = ${JSON.stringify(token)}`,
      `team_drive = ${destinoUnidad}`,
      `root_folder_id = ${destinoUnidad}`,
      '',
    ].join('\n');
    const parcial = path.join(temporal, 'rclone.conf.nuevo');
    fs.writeFileSync(parcial, configuracion, { mode: 0o600, flag: 'wx' });
    // El enlace publica el archivo completo y falla si el destino ya existe.
    try {
      fs.linkSync(parcial, path.join(carpeta, 'rclone.conf'));
    } catch (error) {
      if (error.code === 'EEXIST') fallar('Ya existe rclone.conf. No se reemplazó la configuración.');
      throw error;
    }
    console.log('Autorización guardada.');
    console.log('Falta comprobar el acceso a la unidad compartida y configurar el cifrado.');
  } else {
    fallar('Acción de configuración no reconocida.');
  }
} catch (error) {
  console.error(error.mensajeSeguro || 'No se pudo completar la configuración privada de Drive.');
  process.exitCode = 1;
}
NODE_DRIVE

ejecutar_ayudante_drive() {
  red_ayudante_drive=none
  if [ "$1" = revisar ]; then red_ayudante_drive=host; fi
  docker run --rm --network "$red_ayudante_drive" --read-only --cap-drop ALL \
    --security-opt no-new-privileges \
    --user "$(id -u):$(id -g)" \
    --volume "$carpeta_drive:/config:Z" \
    node:24-bookworm-slim \
    node "/config/${temporal_drive##*/}/configurar.mjs" "$1"
}

ejecutar_ayudante_drive validar
if [ "$accion_drive" = preparar ]; then
  docker run --rm --network none --read-only --cap-drop ALL \
    --security-opt no-new-privileges \
    --user "$(id -u):$(id -g)" "$imagen_drive" version
  printf '%s\n' 'Preparación completa.' \
    'El siguiente paso requiere un túnel SSH local: puerto 53682 hacia 127.0.0.1:53682 de CentOS.'
  exit 0
fi

ejecutar_ayudante_drive entorno
printf '%s\n' \
  'Mantén activo el túnel SSH local del puerto 53682.' \
  'Comprobando el cliente y el permiso solicitado antes de mostrar el enlace de Google…'

# Rclone escucha en 127.0.0.1:53682 de CentOS. El túnel SSH lleva ese
# servicio al navegador local. Su salida con los tokens se captura en privado.
docker run --rm --network host --read-only --cap-drop ALL \
  --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" \
  --cidfile "$temporal_drive/contenedor.id" \
  --env-file "$temporal_drive/credenciales.env" \
  "$imagen_drive" --config '' authorize drive \
  --drive-scope drive.file --auth-no-open-browser \
  > "$temporal_drive/respuesta-oauth.txt" 2> "$temporal_drive/oauth.log" &
proceso_oauth=$!

ejecutar_ayudante_drive revisar
if ! wait "$proceso_oauth"; then
  proceso_oauth=""
  printf '%s\n' 'Google no completó la autorización. Se conservó la configuración anterior.' >&2
  exit 1
fi
proceso_oauth=""
ejecutar_ayudante_drive guardar
