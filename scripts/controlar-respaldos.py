#!/usr/bin/env python3
"""Respaldo semanal, medición y plan de retención; nunca elimina copias."""
import argparse
import datetime as dt
from email.message import EmailMessage
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parents[1]
IMAGEN = 'rclone/rclone:1.75.2@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5'
DESTINATARIO = 'felipe.silva@slepb.gob.cl'
ID = re.compile(r'inventario_(\d{8}T\d{6}Z)_[a-f0-9]{32}')
ARCHIVOS = {'inventario.dump', 'roles.sql', 'metadatos.txt', 'SHA256SUMS'}
TB = 10**12
GB = 10**9


def privado(ruta, directorio=False):
    estado = ruta.lstat()
    tipo = stat.S_ISDIR if directorio else stat.S_ISREG
    if (not tipo(estado.st_mode) or estado.st_uid != os.getuid()
            or stat.S_IMODE(estado.st_mode) != (0o700 if directorio else 0o600)):
        raise ValueError('Se requieren archivos 600 y directorios 700 del usuario actual, sin enlaces.')


def guardar(ruta, datos):
    """Publicar estado privado sin dejar un JSON parcialmente escrito."""
    fd, temporal = tempfile.mkstemp(prefix='.estado-', dir=ruta.parent)
    try:
        with os.fdopen(fd, 'w') as archivo:
            json.dump(datos, archivo, ensure_ascii=False, indent=2)
            archivo.write('\n')
        os.replace(temporal, ruta)
    finally:
        if os.path.exists(temporal):
            os.unlink(temporal)


def validar_marcador(datos, nombre, clave, ahora):
    coincidencia = ID.fullmatch(nombre)
    if not coincidencia:
        raise ValueError('Identificador de respaldo no válido.')
    creado = dt.datetime.strptime(coincidencia[1], '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc)
    verificado = dt.datetime.fromisoformat(datos.get('verificado_en', '').replace('Z', '+00:00'))
    if (datos.get('formato') != 1 or datos.get('sistema') != 'inventario-barrancas'
            or datos.get('postgres_major') != 18 or datos.get('id_respaldo') != nombre
            or datos.get('id_clave') != clave
            or datos.get('verificacion') != 'restauracion_postgresql18'
            or verificado.tzinfo is None or verificado < creado
            or verificado > ahora + dt.timedelta(minutes=5)):
        raise ValueError('Marcador de respaldo no válido o correspondiente a otras claves.')
    archivos = datos.get('archivos', [])
    if (len(archivos) != 4 or {a.get('nombre') for a in archivos} != ARCHIVOS
            or any(type(a.get('bytes')) is not int or a['bytes'] <= 0
                   or not re.fullmatch('[a-f0-9]{64}', a.get('sha256', '')) for a in archivos)):
        raise ValueError('Lista de archivos del marcador no válida.')
    return {'id': nombre, 'creado': creado, 'bytes': sum(a['bytes'] for a in archivos)}


def planificar(copias):
    """Una copia por semana/mes en Santiago; unión sin duplicados."""
    semanales, mensuales, conservar = set(), set(), set()
    zona = ZoneInfo('America/Santiago')
    for copia in sorted(copias, key=lambda c: (c['creado'], c['id']), reverse=True):
        fecha = copia['creado'].astimezone(zona)
        semana = tuple(fecha.isocalendar()[:2])
        mes = (fecha.year, fecha.month)
        if semana not in semanales and len(semanales) < 8:
            semanales.add(semana)
            conservar.add(copia['id'])
        if mes not in mensuales and len(mensuales) < 12:
            mensuales.add(mes)
            conservar.add(copia['id'])
    return {'conservar': sorted(conservar),
            'candidatas_vencidas': sorted(c['id'] for c in copias if c['id'] not in conservar),
            'borrado_automatico': False}


def nivel(usados, limite):
    if usados >= limite * 9 // 10:
        return 'critico'
    if usados >= limite * 8 // 10:
        return 'advertencia'
    return 'normal'


def medir_local(ruta):
    """No seguir enlaces, ni contar rutas externas al almacenamiento local."""
    total = 0
    if not ruta.exists():
        return 0
    if ruta.is_symlink() or not ruta.is_dir():
        raise ValueError('El almacenamiento local no puede ser un enlace.')
    for raiz, directorios, archivos in os.walk(ruta, followlinks=False):
        for nombre in directorios + archivos:
            estado = (Path(raiz) / nombre).lstat()
            if stat.S_ISLNK(estado.st_mode):
                raise ValueError('Se encontró un enlace en el almacenamiento local.')
            total += estado.st_blocks * 512
    return total


class Control:
    def __init__(self, configuracion):
        self.config = configuracion

    def rclone(self, *args):
        resultado = subprocess.run([
            'docker', 'run', '--rm', '--read-only', '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges', '--user', f'{os.getuid()}:{os.getgid()}',
            '--tmpfs', '/tmp:rw,nosuid,nodev,size=32m,mode=1777',
            '--volume', f'{self.config}:/config:Z', '--entrypoint', '/bin/sh', IMAGEN,
            '-c', 'umask 077; exec rclone "$@"', 'sh',
            '--config', '/config/rclone.conf', '--cache-dir', '/tmp/cache',
            '--log-level', 'ERROR', '--stats', '0', '--contimeout', '10s',
            '--timeout', '120s', '--retries', '2', '--low-level-retries', '3', *args
        ], capture_output=True, text=True, timeout=600)
        if resultado.returncode:
            # No reenviar errores del proveedor: podrían contener credenciales.
            raise RuntimeError('No se pudo consultar Drive; no se efectuó ninguna eliminación.')
        return json.loads(resultado.stdout)

    def informe(self, ahora):
        llave = self.config / 'recuperacion-cifrado.json'
        privado(llave)
        clave = json.loads(llave.read_text())
        if (clave.get('sistema') != 'inventario-barrancas' or clave.get('formato') != 1
                or clave.get('unidad_id') != '0AFt45KLDJwTFUk9PVA'
                or clave.get('carpeta_remota') != 'PostgreSQL-Cifrado'
                or not re.fullmatch('[a-f0-9-]{36}', clave.get('id_clave', ''))):
            raise ValueError('La configuración no corresponde al destino esperado.')
        # Mide bytes cifrados reales de esta carpeta, incluidos envíos incompletos.
        uso = self.rclone('size', 'barrancas_drive:PostgreSQL-Cifrado', '--json')
        usados = uso.get('bytes')
        if type(usados) is not int or usados < 0:
            raise ValueError('Drive no informó un tamaño válido.')
        entradas = self.rclone('lsjson', 'barrancas_cifrado:', '--dirs-only')
        copias, desconocidas, vistos = [], [], set()
        for entrada in entradas:
            nombre = entrada.get('Path', '')
            if not ID.fullmatch(nombre) or not entrada.get('IsDir'):
                desconocidas.append(nombre)
                continue
            if nombre in vistos:
                raise ValueError('Hay nombres duplicados en Drive; revisar manualmente.')
            vistos.add(nombre)
            contenido = self.rclone('lsjson', f'barrancas_cifrado:{nombre}')
            if not any(a.get('Path') == 'COMPLETO.json' and not a.get('IsDir') for a in contenido):
                desconocidas.append(nombre)
                continue
            marcador = self.rclone('cat', f'barrancas_cifrado:{nombre}/COMPLETO.json')
            copias.append(validar_marcador(marcador, nombre, clave['id_clave'], ahora))
        local = medir_local(RAIZ / 'backups' / 'postgresql')
        libres = shutil.disk_usage(RAIZ).free
        avisos = []
        for destino, cantidad, limite in [('drive', usados, TB), ('local', local, 50 * GB)]:
            estado = nivel(cantidad, limite)
            if estado != 'normal':
                avisos.append(f'Espacio {destino}: {estado} ({cantidad} de {limite} bytes).')
        if libres < 10 * GB:
            avisos.append('Quedan menos de 10 GB libres en el disco local.')
        ultima = max((c['creado'] for c in copias), default=None)
        if ultima is None or ahora - ultima > dt.timedelta(days=8):
            avisos.append('No hay una copia completada de los últimos ocho días.')
        if desconocidas:
            avisos.append('Hay carpetas sin marcador o nombres desconocidos; requieren revisión.')
        return {'formato': 1, 'medido_en': ahora.isoformat(),
                'drive_bytes': usados, 'drive_presupuesto_bytes': TB,
                'local_bytes': local, 'local_presupuesto_bytes': 50 * GB,
                'local_libres_bytes': libres, 'copias_completadas': len(copias),
                'sin_clasificar': desconocidas, 'avisos': avisos, **planificar(copias)}


def notificar(estado, mensajes):
    correo = EmailMessage()
    correo['To'] = DESTINATARIO
    correo['Subject'] = 'Inventario Barrancas: revisar respaldos'
    correo.set_content('Se requiere revisar el respaldo semanal.\n\n'
                       + '\n'.join(mensajes) + '\n\nConsultar el informe privado en CentOS.\n')
    # El envío requiere un MTA configurado en CentOS. Nunca incluye dumps ni logs.
    fd, nombre = tempfile.mkstemp(prefix='aviso-', suffix='.eml', dir=estado)
    with os.fdopen(fd, 'wb') as archivo:
        archivo.write(bytes(correo))
    transporte = shutil.which('sendmail')
    if not transporte and Path('/usr/sbin/sendmail').is_file():
        transporte = '/usr/sbin/sendmail'
    aceptado = False
    if transporte:
        try:
            resultado = subprocess.run([transporte, '-oi', '-t'], input=bytes(correo),
                                       capture_output=True, timeout=30)
            aceptado = resultado.returncode == 0
        except (OSError, subprocess.TimeoutExpired):
            pass
    if aceptado:
        Path(nombre).unlink()
    return {'destinatario': DESTINATARIO, 'aceptado_por_mta': aceptado,
            'entrega_confirmada': False, 'pendiente': None if aceptado else Path(nombre).name}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--solo-control', action='store_true', help='Medir sin crear otro respaldo')
    parser.add_argument('--probar-aviso', action='store_true', help='Probar el MTA; confirmar recepción aparte')
    args = parser.parse_args()
    os.umask(0o077)
    os.chdir(RAIZ)
    config = Path(os.environ.get('INVENTARIO_RESPALDOS_CONFIG_DIR',
                                 str(Path.home() / '.config/inventario-respaldos')))
    privado(config, True)
    privado(config / 'rclone.conf')
    estado = config / 'control'
    estado.mkdir(mode=0o700, exist_ok=True)
    privado(estado, True)
    # El mismo bloqueo que el servicio existente; no envolver otra vez con flock.
    fd = os.open(config / 'respaldo.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as bloqueo:
        try:
            fcntl.flock(bloqueo, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Ya hay una operación de respaldo en curso.', file=sys.stderr)
            return 1
        if args.probar_aviso:
            aviso = notificar(estado, ['Prueba de avisos. Confirmar recepción en el buzón institucional.'])
            guardar(estado / 'ultimo-aviso.json', aviso)
            print(json.dumps(aviso, ensure_ascii=False))
            return 0 if aviso['aceptado_por_mta'] else 2
        ahora = dt.datetime.now(dt.timezone.utc)
        errores = []
        if not args.solo_control:
            resultado = subprocess.run(['bash', str(RAIZ / 'scripts/respaldar-postgresql-drive.sh')])
            if resultado.returncode:
                errores.append('El respaldo o su restauración no terminaron correctamente.')
        try:
            # Comparte también el bloqueo interno del script para no medir un envío manual.
            interno = config / '.enviando-respaldo'
            interno.mkdir(mode=0o700)
            try:
                informe = Control(config).informe(dt.datetime.now(dt.timezone.utc))
            finally:
                interno.rmdir()
        except Exception:
            errores.append('No se pudo completar la medición o validar el inventario de Drive.')
            informe = {'formato': 1, 'medido_en': ahora.isoformat(), 'avisos': [],
                       'borrado_automatico': False, 'medicion_completa': False}
        informe['errores'] = errores
        mensajes = errores + informe['avisos']
        if mensajes:
            informe['correo'] = notificar(estado, mensajes)
            if not informe['correo']['aceptado_por_mta']:
                print('Aviso pendiente: el correo no fue aceptado por un MTA.', file=sys.stderr)
        guardar(estado / 'ultimo-control.json', informe)
        print('Informe privado: ' + str(estado / 'ultimo-control.json'))
        print('No se eliminó ninguna copia. Borrado automático desactivado.')
        return 1 if errores else (2 if mensajes else 0)


if __name__ == '__main__':
    sys.exit(main())
