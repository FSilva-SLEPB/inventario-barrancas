from pathlib import Path
import configparser
import json
import os
import shutil
import subprocess
import tempfile

RAIZ = Path(__file__).resolve().parents[2]
SCRIPT = RAIZ/'scripts/respaldar-postgresql-drive.sh'
NODE = shutil.which('node')
SECRETO = 'GOCSPX-credencial_ficticia_123456'
ACCESS = 'token_acceso_ficticio_para_pruebas'
REFRESH = 'token_renovable_ficticio_para_pruebas'
UNIDAD = '0AFt45KLDJwTFUk9PVA'
CRYPT = {'type':'crypt','remote':'barrancas_drive:PostgreSQL-Cifrado',
    'filename_encryption':'standard','directory_name_encryption':'true','filename_encoding':'base32',
    'password':'P'*107,'password2':'S'*107}

MOCK_DOCKER = r'''#!/usr/bin/env python3
import configparser, json, os, pathlib, shutil, subprocess, sys
args = sys.argv[1:]
raiz = pathlib.Path(os.environ['ENVIO_PRUEBA_RAIZ'])
with (raiz/'llamadas.jsonl').open('a') as f: f.write(json.dumps(args)+'\n')
assert args[0] == 'run'
montajes = {}
for i,a in enumerate(args):
    if a == '--volume':
        origen,destino,opciones = args[i+1].rsplit(':',2)
        assert opciones in ('Z','ro,Z')
        if destino == '/origen': assert opciones == 'ro,Z'
        montajes[destino] = pathlib.Path(origen)
def local(valor):
    for destino,origen in sorted(montajes.items(),key=lambda x:-len(x[0])):
        if valor == destino or valor.startswith(destino+'/'):
            return origen/valor[len(destino):].lstrip('/')
    raise AssertionError('Ruta sin montaje: '+valor)
if 'node:24-bookworm-slim' in args:
    i = args.index('node:24-bookworm-slim')
    cola = [str(local(a)) if a.startswith('/config/') or a == '/origen' else a for a in args[i+2:]]
    sys.exit(subprocess.run([os.environ['ENVIO_PRUEBA_NODE'],*cola]).returncode)
imagen = next(a for a in args if a.startswith('rclone/rclone:'))
assert imagen.endswith('@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5')
assert '--read-only' in args and '--cap-drop' in args
assert args[args.index('--network')+1] in ('none','bridge')
cola = args[args.index(imagen)+4:]
assert cola[:2] == ['--config','/config/rclone.conf']
pos = next(i for i,a in enumerate(cola) if a in ('config','copy','copyto'))
comando,parametros = cola[pos],cola[pos+1:]
fallo = os.environ.get('ENVIO_PRUEBA_FALLO','')
if comando == 'config':
    conf = configparser.ConfigParser(interpolation=None)
    conf.read(local('/config/rclone.conf'))
    print(json.dumps({s:dict(conf[s]) for s in conf.sections()}))
    sys.exit(0)
def remoto(valor):
    assert valor.startswith('barrancas_cifrado:inventario_')
    relativa = valor.split(':',1)[1]
    assert '..' not in pathlib.PurePosixPath(relativa).parts
    return raiz/'nube'/relativa
def error():
    print('Error ficticio; token_acceso_ficticio_para_pruebas',file=sys.stderr)
    sys.exit(1)
def copiar_archivo(origen,destino):
    destino.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    shutil.copyfile(origen,destino)
    destino.chmod(0o600)
if comando == 'copy':
    assert '--files-from' in parametros
    archivos = local(parametros[parametros.index('--files-from')+1]).read_text().splitlines()
    assert archivos == ['inventario.dump','roles.sql','metadatos.txt','SHA256SUMS']
    if parametros[0] == '/origen':
        assert '--immutable' in parametros
        if fallo == 'subir': error()
        origen,destino = local(parametros[0]),remoto(parametros[1])
    else:
        if fallo == 'descargar': error()
        origen,destino = remoto(parametros[0]),local(parametros[1])
    destino.mkdir(parents=True,exist_ok=True,mode=0o700)
    for nombre in archivos:
        if fallo == 'incompleto' and parametros[0] != '/origen' and nombre == 'roles.sql': continue
        copiar_archivo(origen/nombre,destino/nombre)
    if fallo == 'corrupto' and parametros[0] != '/origen':
        with (destino/'inventario.dump').open('ab') as f: f.write(b'alteracion_ficticia')
elif comando == 'copyto':
    if parametros[0].startswith('/trabajo/publicacion/'):
        assert '--immutable' in parametros
        assert (raiz/'restauraciones.jsonl').exists(), 'Se marcó una copia antes de restaurarla.'
        if fallo == 'publicar': error()
        copiar_archivo(local(parametros[0]),remoto(parametros[1]))
    else:
        origen,destino = remoto(parametros[0]),local(parametros[1])
        if not origen.exists(): error()
        copiar_archivo(origen,destino)
        if fallo == 'marcador_corrupto': destino.write_text('{}')
else: raise AssertionError(comando)
'''

STUB_RESPALDAR = r'''#!/usr/bin/env bash
set -euo pipefail
umask 077
python3 - <<'PY_RESPALDO'
from pathlib import Path
import hashlib,os
raiz=Path.cwd()
carpeta=raiz/'backups'/'postgresql'/'inventario_ficticio'
carpeta.mkdir(parents=True,mode=0o700)
datos={'inventario.dump':b'PGDMP_DATOS_FICTICIOS', 'roles.sql':b'-- Roles ficticios sin contrasenas\n',
       'metadatos.txt':b'formato=1\nproyecto=inventario-barrancas\nbase=inventario\npostgres_major=18\n'}
for nombre,contenido in datos.items():
    archivo=carpeta/nombre
    archivo.write_bytes(contenido)
    archivo.chmod(0o600)
archivo=carpeta/'SHA256SUMS'
archivo.write_text(''.join(f'{hashlib.sha256(c).hexdigest()}  {n}\n' for n,c in datos.items()))
archivo.chmod(0o600)
if os.environ.get('ENVIO_PRUEBA_FALLO') == 'archivo_extra':
    (carpeta/'recuperacion-cifrado.json').write_text('Ficticio; debe impedir la subida.')
(Path(os.environ['ENVIO_PRUEBA_RAIZ'])/'respaldo_creado').touch()
print(carpeta)
PY_RESPALDO
'''

STUB_VERIFICAR = r'''#!/usr/bin/env bash
set -euo pipefail
python3 - "$1" <<'PY_RESTAURACION'
from pathlib import Path
import json,os,sys
raiz=Path(os.environ['ENVIO_PRUEBA_RAIZ'])
origen=Path(sys.argv[1])
assert origen.name == 'recuperado'
assert origen.parent.name.startswith('.envio.')
assert (origen/'inventario.dump').read_bytes() == b'PGDMP_DATOS_FICTICIOS'
with (raiz/'restauraciones.jsonl').open('a') as f:
    f.write(json.dumps({'origen':str(origen),'marcadores':len(list((raiz/'nube').glob('inventario_*/COMPLETO.json')))})+'\n')
if os.environ.get('ENVIO_PRUEBA_FALLO') == 'restauracion': sys.exit(1)
print('Restauración ficticia comprobada por el simulador.')
PY_RESTAURACION
'''


def base(raiz):
    proyecto=raiz/'proyecto'
    proyecto.mkdir()
    subprocess.run(['git','init','-q',str(proyecto)],check=True)
    (proyecto/'.gitignore').write_text('/backups/\n')
    (proyecto/'scripts').mkdir()
    (proyecto/'scripts'/'respaldar-postgresql.sh').write_text(STUB_RESPALDAR)
    (proyecto/'scripts'/'verificar-respaldo-postgresql.sh').write_text(STUB_VERIFICAR)
    (proyecto/'database').mkdir()
    (proyecto/'database'/'verificar-restauracion.sql').write_text('-- Ficticio\n')
    carpeta=raiz/'configuracion privada'
    carpeta.mkdir(mode=0o700)
    llave={'formato':1,'sistema':'inventario-barrancas','unidad_id':UNIDAD,
        'id_clave':'11111111-1111-4111-8111-111111111111','carpeta_remota':'PostgreSQL-Cifrado','crypt':CRYPT}
    (carpeta/'recuperacion-cifrado.json').write_text(json.dumps(llave))
    (carpeta/'recuperacion-cifrado.json').chmod(0o600)
    secciones={'barrancas_drive':{'type':'drive','client_id':'123456789-ficticio.apps.googleusercontent.com',
        'client_secret':SECRETO,'scope':'drive.file','team_drive':UNIDAD,'root_folder_id':UNIDAD,
        'token':json.dumps({'access_token':ACCESS,'refresh_token':REFRESH,'expiry':'2099-01-01T00:00:00Z'})},
        'barrancas_cifrado':CRYPT}
    contenido=''.join('['+nombre+']\n'+''.join(k+' = '+v+'\n' for k,v in valores.items())+'\n'
        for nombre,valores in secciones.items())
    (carpeta/'rclone.conf').write_text(contenido)
    (carpeta/'rclone.conf').chmod(0o600)
    (raiz/'bin').mkdir()
    (raiz/'bin'/'docker').write_text(MOCK_DOCKER)
    (raiz/'bin'/'docker').chmod(0o755)
    (raiz/'nube'/'anterior').mkdir(parents=True)
    (raiz/'nube'/'anterior'/'archivo').write_text('Debe conservarse.')
    entorno=dict(os.environ)
    entorno.update({'ENVIO_PRUEBA_RAIZ':str(raiz),'ENVIO_PRUEBA_NODE':NODE,
        'INVENTARIO_RESPALDOS_CONFIG_DIR':str(carpeta),
        'PATH':str(raiz/'bin')+os.pathsep+entorno['PATH']})
    return proyecto,carpeta,entorno


def ejecutar(raiz,proyecto,carpeta,entorno,*args):
    cfg=(carpeta/'rclone.conf').read_bytes()
    llave=(carpeta/'recuperacion-cifrado.json').read_bytes()
    resultado=subprocess.run(['bash',str(SCRIPT),*args],cwd=proyecto,env=entorno,capture_output=True,text=True)
    mensajes=resultado.stdout+resultado.stderr
    for valor in (SECRETO,ACCESS,REFRESH,CRYPT['password'],CRYPT['password2']): assert valor not in mensajes
    assert (carpeta/'rclone.conf').read_bytes() == cfg
    assert (carpeta/'recuperacion-cifrado.json').read_bytes() == llave
    assert not list(carpeta.glob('.envio.*'))
    assert not (carpeta/'.enviando-respaldo').exists()
    assert (raiz/'nube'/'anterior'/'archivo').read_text() == 'Debe conservarse.'
    return resultado


def correcto(raiz):
    proyecto,carpeta,entorno=base(raiz)
    resultado=ejecutar(raiz,proyecto,carpeta,entorno)
    assert resultado.returncode == 0, resultado.stderr
    constancia=Path(resultado.stdout.strip())
    assert constancia.exists() and constancia.stat().st_mode & 0o777 == 0o600
    datos=json.loads(constancia.read_text())
    copia=raiz/'nube'/datos['id_respaldo']
    assert {f.name for f in copia.iterdir()} == {'inventario.dump','roles.sql','metadatos.txt','SHA256SUMS','COMPLETO.json'}
    restauraciones=[json.loads(l) for l in (raiz/'restauraciones.jsonl').read_text().splitlines()]
    assert restauraciones[0]['marcadores'] == 0
    llamadas_antes=len((raiz/'llamadas.jsonl').read_text().splitlines())
    (raiz/'respaldo_creado').unlink()
    verificado=ejecutar(raiz,proyecto,carpeta,entorno,'--verificar',datos['id_respaldo'])
    assert verificado.returncode == 0, verificado.stderr
    assert not (raiz/'respaldo_creado').exists()
    assert Path(verificado.stdout.strip()).exists()
    llamadas=[json.loads(l) for l in (raiz/'llamadas.jsonl').read_text().splitlines()[llamadas_antes:]]
    for llamada in llamadas:
        if 'copy' in llamada:
            i=llamada.index('copy')
            assert llamada[i+1].startswith('barrancas_cifrado:')
        if 'copyto' in llamada:
            i=llamada.index('copyto')
            assert llamada[i+1].startswith('barrancas_cifrado:')
    assert constancia.read_text() == json.dumps(datos,indent=2)+'\n'


def fallo(raiz,tipo):
    proyecto,carpeta,entorno=base(raiz)
    entorno['ENVIO_PRUEBA_FALLO']=tipo
    resultado=ejecutar(raiz,proyecto,carpeta,entorno)
    assert resultado.returncode != 0
    assert not list((proyecto/'backups'/'drive').glob('*.json'))
    if tipo not in ('marcador_corrupto',): assert not list((raiz/'nube').glob('inventario_*/COMPLETO.json'))
    if tipo in ('subir','descargar','incompleto','corrupto','archivo_extra'):
        assert not (raiz/'restauraciones.jsonl').exists()


def configuracion_invalida(raiz,tipo):
    proyecto,carpeta,entorno=base(raiz)
    archivo=carpeta/'rclone.conf'
    if tipo == 'unidad': archivo.write_text(archivo.read_text().replace(UNIDAD,'otra_unidad_ficticia'))
    elif tipo == 'scope': archivo.write_text(archivo.read_text().replace('scope = drive.file','scope = drive'))
    elif tipo == 'clave': archivo.write_text(archivo.read_text().replace('P'*107,'D'*107))
    elif tipo == 'permisos': archivo.chmod(0o644)
    else: raise AssertionError(tipo)
    resultado=ejecutar(raiz,proyecto,carpeta,entorno)
    assert resultado.returncode != 0
    assert not (raiz/'respaldo_creado').exists()


def rechazar_identificador(raiz):
    proyecto,carpeta,entorno=base(raiz)
    resultado=ejecutar(raiz,proyecto,carpeta,entorno,'--verificar','../otro-destino')
    assert resultado.returncode != 0
    assert not (raiz/'llamadas.jsonl').exists()


casos=[('envío completo y verificación posterior de solo lectura',correcto)]
for tipo in ('subir','descargar','incompleto','corrupto','restauracion','publicar','marcador_corrupto','archivo_extra'):
    casos.append((f'fallo sin publicación prematura: {tipo}',lambda r,t=tipo:fallo(r,t)))
for tipo in ('unidad','scope','clave','permisos'):
    casos.append((f'rechazo de configuración: {tipo}',lambda r,t=tipo:configuracion_invalida(r,t)))
casos.append(('rechazo de identificador ajeno',rechazar_identificador))
for nombre,caso in casos:
    with tempfile.TemporaryDirectory(prefix='prueba-envio-') as temporal:
        caso(Path(temporal))
    print(f'Correcto: {nombre}',flush=True)
print(f'{len(casos)} comprobaciones con Drive y PostgreSQL simulados. No se usaron credenciales reales.')
