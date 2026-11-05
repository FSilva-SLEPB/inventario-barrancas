"""Escenarios ficticios de aislamiento, revisión efectiva y ausencia de secretos en la salida."""
import importlib.util
from pathlib import Path
from copy import deepcopy
import contextlib
import io
import json
import os
import tempfile
from unittest.mock import patch

raiz = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('instalacion', raiz / 'scripts/revisar-instalacion.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
revision = 'a' * 40
secreto = 'SECRETO-FICTICIO-QUE-NUNCA-DEBE-SALIR-EN-EL-INFORME'
e = {'NODE_ENV': 'production', 'NEXTAUTH_URL': 'http://localhost:3000',
     'NEXTAUTH_SECRET': secreto, 'GOOGLE_CLIENT_ID': 'id-ficticio',
     'GOOGLE_CLIENT_SECRET': secreto, 'DATABASE_URL': 'postgresql://inventario_app:'+secreto+'@db:5432/inventario',
     'ACTAS_CORREO_MODO': 'prueba', 'ACTAS_CORREO_PRUEBA_DESTINATARIOS': ''}
config = {'services': {'web': {'environment': e, 'read_only': True, 'user': '1000:1000',
            'cap_drop': ['ALL'], 'security_opt': ['no-new-privileges:true'], 'ports': [{'host_ip': '127.0.0.1', 'target': 3000, 'published': '3000'}]},
          'db': {'environment': {'POSTGRES_PASSWORD': secreto, 'APP_DB_PASSWORD': secreto}}},
          'volumes': {'postgres_data': {'name': 'inventario-barrancas_postgres_data'}}}
web = {'State': {'Status': 'running', 'Health': {'Status': 'healthy'}},
       'Config': {'User': '1000:1000', 'Cmd': ['node', 'server.js'], 'Entrypoint': ['docker-entrypoint.sh'], 'WorkingDir': '/app', 'Env': [k+'='+v for k,v in e.items()],
                  'Labels': {'org.opencontainers.image.revision': revision,
                  'com.docker.compose.project': 'inventario-barrancas', 'com.docker.compose.service': 'web'}},
       'HostConfig': {'ReadonlyRootfs': True, 'CapDrop': ['ALL'], 'CapAdd': [],
           'SecurityOpt': ['no-new-privileges:true'], 'RestartPolicy': {'Name': 'unless-stopped'}},
       'Mounts': [{'Type': 'tmpfs'}], 'NetworkSettings': {'Ports': {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3000'}]}}}
db = {'State': deepcopy(web['State']), 'Config': {'Env': [], 'Labels': {
       'com.docker.compose.project': 'inventario-barrancas', 'com.docker.compose.service': 'db'}},
      'HostConfig': {}, 'NetworkSettings': {'Ports': {'5432/tcp': None}}}
registro = {'driver': 'json-file', 'options': {'max-size': '10m', 'max-file': '3'}}
for servicio, c in [('web', web), ('db', db)]:
    config['services'][servicio]['logging'] = deepcopy(registro)
    c['HostConfig']['LogConfig'] = {'Type': 'json-file', 'Config': deepcopy(registro['options'])}
db['Mounts'] = [{'Type': 'volume', 'Name': 'inventario-barrancas_postgres_data', 'Destination': '/var/lib/postgresql'}]
pruebas = 0

def actualizar_entorno(w, nuevos):
    valores = {v.split('=', 1)[0]: v.split('=', 1)[1] for v in w['Config']['Env']}
    valores.update(nuevos)
    w['Config']['Env'] = [k + '=' + v for k, v in valores.items()]


def revisar(w=web, d=db, c=config, r=revision):
    salida = mod.revisar_contenedores(w,d,c,r,True)
    assert secreto not in json.dumps(salida)
    return salida

assert not revisar()[0]
assert revisar()[1] and any('HTTPS' in x for x in revisar()[1]);pruebas += 1
for cambiar in [
    lambda w: w['State'].update(Status='exited'),
    lambda w: w['State']['Health'].update(Status='unhealthy'),
    lambda w: w['Config'].update(User='root'),
    lambda w: w['Config'].update(Cmd=['npm','run','dev']),
    lambda w: w['Config'].update(Entrypoint=['/bin/sh','-c','exec otra-web']),
    lambda w: w['Config'].update(WorkingDir='/tmp'),
    lambda w: w['Config'].update(Env=w['Config']['Env']+['NODE_ENV=production']),
    lambda w: w['HostConfig'].update(Privileged=True),
    lambda w: w['HostConfig'].update(ReadonlyRootfs=False),
    lambda w: w['HostConfig'].update(CapDrop=[]),
    lambda w: w['HostConfig'].update(CapAdd=['NET_ADMIN']),
    lambda w: w['HostConfig'].update(SecurityOpt=[]),
    lambda w: w['HostConfig'].update(NetworkMode='host'),
    lambda w: w['HostConfig'].update(RestartPolicy={'Name':'no'}),
    lambda w: w.update(Mounts=[{'Type':'bind','Source':secreto}]),
    lambda w: w['Config']['Labels'].update({'org.opencontainers.image.revision':'b'*40}),
    lambda w: actualizar_entorno(w, {'NODE_ENV':'development'}),
    lambda w: w['NetworkSettings'].update(Ports={'3000/tcp':[{'HostIp':'0.0.0.0','HostPort':'3000'}]}),
    lambda w: w['NetworkSettings'].update(Ports={'3000/tcp':[{'HostIp':'::','HostPort':'3000'}]}),
    lambda w: w['NetworkSettings'].update(Ports={}),
    lambda w: w['NetworkSettings'].update(Ports={'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'4000'}]}),
    lambda w: w['HostConfig'].update(LogConfig={'Type':'json-file','Config':{}}),
]:
    w = deepcopy(web);cambiar(w);assert revisar(w)[0];pruebas += 1
for cambio in [
    {'NetworkSettings': {'Ports': {'5432/tcp':[{'HostIp':'127.0.0.1','HostPort':'5432'}]}}},
    {'HostConfig': {'NetworkMode':'host'}}, {'HostConfig': {'Privileged':True}},
    {'Mounts': [{'Type':'volume','Name': 'otra_base', 'Destination':'/var/lib/postgresql'}]},
    {'Mounts': [{'Type':'bind','Name': 'inventario-barrancas_postgres_data', 'Destination':'/var/lib/postgresql'}]},
    {'Mounts': []},
]:
    d=deepcopy(db);d.update(cambio);assert revisar(d=d)[0];pruebas += 1
for extra in [
    ['ACTAS_CORREO_MODO=produccion'], ['ACTAS_CORREO_MODO=desconocido'],
    ['ACTAS_CORREO_PRUEBA_DESTINATARIOS=real@example.org'],
    ['ACTAS_CORREO_PRUEBA_DESTINATARIOS=correoprueba@slepb.gob.cl,otra@example.org'],
]:
    w=deepcopy(web);actualizar_entorno(w,{v.split('=',1)[0]:v.split('=',1)[1] for v in extra});assert revisar(w)[0];pruebas+=1
w=deepcopy(web);actualizar_entorno(w,{'ACTAS_CORREO_PRUEBA_DESTINATARIOS':'correoprueba@slepb.gob.cl','ACTAS_SMTP_HOST':'smtp.example.org','ACTAS_CORREO_REMITENTE':'noreply@slepb.gob.cl'});c=deepcopy(config);c['services']['web']['environment']={line.split('=',1)[0]:line.split('=',1)[1] for line in w['Config']['Env']};fallos,pendientes=revisar(w,c=c);assert not fallos and any('recepción' in x for x in pendientes);pruebas+=1

for clave in ['NODE_OPTIONS','NODE_PATH','LD_PRELOAD','LD_LIBRARY_PATH','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED','OPENSSL_CONF']:
    w=deepcopy(web);actualizar_entorno(w,{clave:secreto});assert any('no previstos' in e for e in revisar(w)[0]);pruebas+=1
w=deepcopy(web);actualizar_entorno(w,{'NODE_TLS_REJECT_UNAUTHORIZED':'0'});c=deepcopy(config);c['services']['web']['environment']['NODE_TLS_REJECT_UNAUTHORIZED']='0';assert any('TLS de Node' in e for e in revisar(w,c=c)[0]);pruebas+=1

with tempfile.TemporaryDirectory() as t:
    archivo=Path(t)/'.env';archivo.write_text(secreto);archivo.chmod(0o600)
    assert not mod.comprobar_archivo_privado(archivo);pruebas+=1
    archivo.chmod(0o644);assert mod.comprobar_archivo_privado(archivo);archivo.chmod(0o600);pruebas+=1
    enlace=Path(t)/'enlace';enlace.symlink_to(archivo);assert mod.comprobar_archivo_privado(enlace);pruebas+=1
    ordenes=[]
    def ejecutar(args,cwd=raiz):
        ordenes.append(args)
        if args[:3]==['git','rev-parse','HEAD']: return revision
        if args[-3:]==['config','--format','json']:return json.dumps(config)
        if args[-3:]==['ps','--quiet','web']:return '1'*64
        if args[-3:]==['ps','--quiet','db']:return '2'*64
        if args[:2]==['docker','inspect']:return json.dumps([web if args[2]=='1'*64 else db])
        raise AssertionError('Consulta no prevista')
    with patch.object(mod,'ejecutar',side_effect=ejecutar):
        salida=io.StringIO()
        with contextlib.redirect_stdout(salida):codigo=mod.main(['--env-file',str(archivo),'--prueba-local'])
        assert codigo==2 and 'OK:' in salida.getvalue() and 'PENDIENTE:' in salida.getvalue()
        assert secreto not in salida.getvalue()
        assert all(not any(a in ('up','run','exec','start','stop','restart','build') for a in o) for o in ordenes);pruebas+=1
    with patch.object(mod,'ejecutar',side_effect=ValueError(secreto)):
        salida=io.StringIO()
        with contextlib.redirect_stdout(salida):codigo=mod.main(['--env-file',str(archivo),'--prueba-local'])
        assert codigo==1 and secreto not in salida.getvalue();pruebas+=1
    with patch.object(mod,'ejecutar',return_value=json.dumps([{'Config':{'Env':[secreto]}}])):
        salida=io.StringIO()
        with contextlib.redirect_stdout(salida):codigo=mod.main(['--env-file',str(archivo)])
        assert codigo==1 and secreto not in salida.getvalue();pruebas+=1
print(f'{pruebas} escenarios de instalación efectiva: aislamiento, estados, revisión, correo restringido, permisos privados, errores sin secretos y consultas sin mutaciones.')
