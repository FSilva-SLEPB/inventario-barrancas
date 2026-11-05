#!/usr/bin/env python3
"""Revisa la instalación efectiva sin iniciar servicios, escribir datos ni enviar correo."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

# La revisión no debe crear __pycache__ en la instalación.
sys.dont_write_bytecode = True

RAIZ = Path(__file__).resolve().parents[1]
BUZON_PRUEBA = 'correoprueba@slepb.gob.cl'
ID_CONTENEDOR = re.compile(r'[a-f0-9]{12,64}')
REVISION = re.compile(r'[a-f0-9]{40}')


def ejecutar(orden, cwd=RAIZ):
    """Los diagnósticos del proveedor pueden contener secretos: nunca se reproducen."""
    try:
        r = subprocess.run(orden, cwd=cwd, capture_output=True, text=True,
                           check=False, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        raise ValueError('No se pudo completar una consulta de la instalación.') from None
    if r.returncode:
        raise ValueError('No se pudo completar una consulta de la instalación.')
    return r.stdout


def entorno(contenedor):
    resultado = {}
    for linea in contenedor.get('Config', {}).get('Env', []) or []:
        if isinstance(linea, str) and '=' in linea:
            k, v = linea.split('=', 1)
            resultado[k] = v
    return resultado


def revisar_contenedores(web, db, config, revision, prueba_local=False):
    """Devuelve solamente mensajes predeterminados, nunca valores de configuración."""
    errores, pendientes = [], []
    host = web.get('HostConfig', {})
    actual = entorno(web)
    esperado = config.get('services', {}).get('web', {}).get('environment', {})
    for nombre, c in [('web', web), ('PostgreSQL', db)]:
        estado = c.get('State', {})
        if c.get('HostConfig', {}).get('Privileged'):
            errores.append(nombre + ': ejecución privilegiada activada.')
        if estado.get('Status') != 'running':
            errores.append(nombre + ': el contenedor no está en ejecución.')
        if estado.get('Health', {}).get('Status') != 'healthy':
            errores.append(nombre + ': no tiene salud healthy comprobada.')
    if web.get('Config', {}).get('User') not in ('1000:1000', 'node'):
        errores.append('Web: usuario distinto del usuario limitado previsto.')
    if not host.get('ReadonlyRootfs'):
        errores.append('Web: la raíz no es de solo lectura.')
    if host.get('CapAdd'):
        errores.append('Web: se añadieron capacidades adicionales.')
    if not any(str(c).upper() == 'ALL' for c in host.get('CapDrop', []) or []):
        errores.append('Web: no se retiraron todas las capacidades adicionales.')
    if not any(s in ('no-new-privileges', 'no-new-privileges:true')
               for s in host.get('SecurityOpt', []) or []):
        errores.append('Web: falta no-new-privileges.')
    if host.get('NetworkMode') == 'host':
        errores.append('Web: utiliza la red del host.')
    if any(m.get('Type') in ('bind', 'volume') for m in web.get('Mounts', []) or []):
        errores.append('Web: tiene montajes persistentes o de código no previstos.')
    if host.get('RestartPolicy', {}).get('Name') not in ('always', 'unless-stopped'):
        errores.append('Web: falta una política de reinicio persistente.')
    puertos = web.get('NetworkSettings', {}).get('Ports', {}) or {}
    publicados = [(p, e) for p, lista in puertos.items() for e in lista or []]
    if not publicados or any(p != '3000/tcp' or e.get('HostIp') not in ('127.0.0.1', '::1')
                             for p, e in publicados):
        errores.append('Web: publicación efectiva ausente o distinta de loopback en el puerto previsto.')
    if db.get('HostConfig', {}).get('NetworkMode') == 'host' or any(
            lista for lista in (db.get('NetworkSettings', {}).get('Ports', {}) or {}).values()):
        errores.append('PostgreSQL: expuesto fuera de la red privada de contenedores.')
    esperados = config.get('services', {}).get('web', {}).get('ports', [])
    enlaces = {(p, e.get('HostIp'), str(e.get('HostPort'))) for p, e in publicados}
    destinos = {(str(p.get('target')) + '/' + p.get('protocol', 'tcp'), p.get('host_ip'), str(p.get('published'))) for p in esperados}
    if enlaces != destinos:
        errores.append('Web: los puertos efectivos no coinciden con Compose.')
    volumen = config.get('volumes', {}).get('postgres_data', {}).get('name')
    montajes = [m for m in db.get('Mounts', []) or [] if m.get('Destination') == '/var/lib/postgresql']
    if len(montajes) != 1 or montajes[0].get('Type') != 'volume' or montajes[0].get('Name') != volumen:
        errores.append('PostgreSQL: el volumen instalado no coincide con el volumen persistente de Compose.')
    for servicio, c in [('web', web), ('db', db)]:
        deseado = config.get('services', {}).get(servicio, {}).get('logging', {})
        log = c.get('HostConfig', {}).get('LogConfig', {})
        if log.get('Type') != deseado.get('driver') or any(str(log.get('Config', {}).get(k, '')) != str(v) for k, v in deseado.get('options', {}).items()):
            errores.append(servicio + ': la rotación de registros no coincide con Compose.')
    if (actual.get('NODE_ENV') != 'production' or web.get('Config', {}).get('Cmd') != ['node', 'server.js']
            or web.get('Config', {}).get('Entrypoint') != ['docker-entrypoint.sh']
            or web.get('Config', {}).get('WorkingDir') != '/app'):
        errores.append('Web: no ejecuta el servidor compilado previsto.')
    nombres = [v.split('=', 1)[0] for v in web.get('Config', {}).get('Env', []) or [] if isinstance(v, str) and '=' in v]
    if len(nombres) != len(set(nombres)):
        errores.append('Web: contiene variables de entorno repetidas.')
    carga = ('NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH',
             'NODE_EXTRA_CA_CERTS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'OPENSSL_CONF')
    if any(k in actual and k not in esperado for k in carga):
        errores.append('Web: existen ajustes de ejecución o confianza no previstos en Compose.')
    if actual.get('NODE_TLS_REJECT_UNAUTHORIZED') == '0':
        errores.append('Web: la validación TLS de Node está desactivada.')
    if any(str(actual.get(k, '')) != str(v) for k, v in esperado.items()):
        errores.append('Web: la configuración en ejecución difiere de Compose; revisar antes de recrear.')
    etiqueta = web.get('Config', {}).get('Labels', {}).get('org.opencontainers.image.revision', '')
    if not REVISION.fullmatch(etiqueta) or etiqueta != revision:
        errores.append('Web: la revisión de la imagen no coincide con el código local revisado.')
    modo = actual.get('ACTAS_CORREO_MODO', 'prueba')
    lista = [v.strip().lower() for v in actual.get('ACTAS_CORREO_PRUEBA_DESTINATARIOS', '').split(',') if v.strip()]
    transporte = bool(actual.get('ACTAS_SMTP_HOST') or actual.get('ACTAS_CORREO_REMITENTE'))
    if modo != 'prueba':
        errores.append('Actas: el modo no coincide con el ensayo de correo acordado.')
    if lista and lista != [BUZON_PRUEBA]:
        errores.append('Actas: la lista de ensayo no contiene únicamente el buzón autorizado.')
    if transporte and (lista != [BUZON_PRUEBA] or not actual.get('ACTAS_SMTP_HOST')
                       or not actual.get('ACTAS_CORREO_REMITENTE')):
        pendientes.append('Actas: configuración de correo de prueba incompleta; no ensayar todavía.')
    elif not transporte:
        pendientes.append('Actas: transporte institucional pendiente de configurar.')
    else:
        pendientes.append('Actas: configuración presente; TLS, autorización SMTP y recepción aún requieren ensayo al buzón autorizado.')
    if prueba_local:
        pendientes.append('Origen local de ensayo: HTTPS y cookies seguras del origen definitivo pendientes de comprobar.')
    else:
        pendientes.append('HTTPS y cookies: comprobar certificado, proxy y navegador en el origen definitivo.')
    pendientes.extend([
        'Completar inicio de sesión real de Google y revisión de accesos por perfil.',
        'Revisar firewall, SELinux, parches y recuperación programada en CentOS.',
    ])
    return errores, pendientes


def comprobar_archivo_privado(ruta):
    try:
        e = ruta.lstat()
        if not stat.S_ISREG(e.st_mode) or e.st_uid != os.getuid() or stat.S_IMODE(e.st_mode) & 0o077:
            return ['El archivo de configuración debe ser privado, regular y del usuario que ejecuta la revisión.']
    except OSError:
        return ['No se pudo comprobar el archivo privado de configuración.']
    return []


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project-name', default='inventario-barrancas')
    p.add_argument('--env-file', type=Path, default=RAIZ / '.env')
    p.add_argument('--prueba-local', action='store_true', help='Reconoce el acceso HTTP de loopback como ensayo, sin certificar HTTPS.')
    args = p.parse_args(argv)
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{0,62}', args.project_name):
        p.error('Nombre de proyecto no válido.')
    spec = importlib.util.spec_from_file_location('preflight_instalacion', RAIZ / 'scripts/verificar-produccion.py')
    preflight = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(preflight)
    archivo = args.env_file.resolve() if not args.env_file.is_symlink() else args.env_file
    errores = comprobar_archivo_privado(archivo)
    if errores:
        for e in errores:
            print('ERROR: ' + e)
        return 1
    compose = ['docker', 'compose', '--env-file', str(archivo), '-p', args.project_name,
               '-f', str(RAIZ / 'compose.produccion.yaml')]
    try:
        config = json.loads(ejecutar(compose + ['config', '--format', 'json']))
        errores, _ = preflight.revisar(config, args.prueba_local)
        revision = ejecutar(['git', 'rev-parse', 'HEAD']).strip()
        if not REVISION.fullmatch(revision):
            raise ValueError('No se pudo identificar la revisión local.')
        contenedores = []
        for servicio in ('web', 'db'):
            cid = ejecutar(compose + ['ps', '--quiet', servicio]).strip()
            if not ID_CONTENEDOR.fullmatch(cid):
                raise ValueError('No se identificaron los dos servicios en ejecución del proyecto.')
            inspeccion = json.loads(ejecutar(['docker', 'inspect', cid]))
            if not isinstance(inspeccion, list) or len(inspeccion) != 1:
                raise ValueError('Respuesta no válida al inspeccionar un servicio.')
            c = inspeccion[0]
            etiquetas = c.get('Config', {}).get('Labels', {})
            if etiquetas.get('com.docker.compose.project') != args.project_name or etiquetas.get('com.docker.compose.service') != servicio:
                raise ValueError('El contenedor no corresponde al proyecto y servicio solicitados.')
            contenedores.append(c)
        fallos, pendientes = revisar_contenedores(*contenedores, config, revision, args.prueba_local)
        errores.extend(fallos)
        print('Revisión de solo lectura de la instalación efectiva.')
        print('Revisión del código: ' + revision)
        for e in errores:
            print('ERROR: ' + e)
        if not errores:
            print('OK: servicios, imagen compilada, revisión, aislamiento y configuración efectiva comprobados.')
        for e in pendientes:
            print('PENDIENTE: ' + e)
        print('No se iniciaron servicios, se escribieron datos ni se enviaron correos. No certifica toda la seguridad del host.')
        return 1 if errores else 2
    except (ValueError, TypeError, KeyError, AttributeError, OSError):
        print('ERROR: no se completó la revisión. Revisar servicios, configuración privada y permisos; los valores y diagnósticos privados se omitieron.')
        return 1


if __name__ == '__main__':
    sys.exit(main())
