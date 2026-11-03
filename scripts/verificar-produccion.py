#!/usr/bin/env python3
"""Revisión de configuración; no inicia servicios ni modifica datos."""
import argparse
import json
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, unquote


def revisar(config, prueba_local=False):
    errores=[]
    servicios=config.get('services',{})
    web=servicios.get('web',{})
    db=servicios.get('db',{})
    e=web.get('environment',{})
    d=db.get('environment',{})
    try:
        url=urlsplit(e.get('NEXTAUTH_URL',''))
        local=prueba_local and url.scheme=='http' and url.hostname in ('localhost','127.0.0.1')
        if not url.hostname or not (url.scheme=='https' or local) or url.username or url.password or url.path not in ('','/') or url.query or url.fragment:
            errores.append('NEXTAUTH_URL debe ser el origen HTTPS canónico; HTTP de loopback solo se admite para la prueba local.')
    except ValueError:
        errores.append('Revisa NEXTAUTH_URL.')
    if len(e.get('NEXTAUTH_SECRET','').encode())<32:errores.append('NEXTAUTH_SECRET requiere al menos 32 bytes.')
    if not e.get('GOOGLE_CLIENT_ID') or not e.get('GOOGLE_CLIENT_SECRET'):errores.append('Falta la configuración del cliente web de Google.')
    if e.get('NODE_ENV')!='production':errores.append('La web debe ejecutarse en modo production.')
    if web.get('volumes'):errores.append('La web de producción no debe montar el código del equipo de desarrollo.')
    if 'ALL' not in web.get('cap_drop',[]):errores.append('La web debe retirar las capacidades de Linux no necesarias.')
    if 'no-new-privileges:true' not in web.get('security_opt',[]):errores.append('La web debe impedir adquirir nuevos privilegios.')
    if not web.get('read_only'):errores.append('La raíz de la web debe ser de solo lectura.')
    if web.get('user') not in ('1000:1000','node'):errores.append('La web debe ejecutarse con el usuario no privilegiado previsto.')
    for puerto in web.get('ports',[]):
        if puerto.get('host_ip') not in ('127.0.0.1','::1'):errores.append('La web debe publicarse solo en loopback detrás del proxy HTTPS.')
    if db.get('ports'):errores.append('PostgreSQL no debe publicar puertos en esta configuración.')
    if not d.get('POSTGRES_PASSWORD') or not d.get('APP_DB_PASSWORD'):errores.append('Faltan credenciales de PostgreSQL.')
    try:
        conexion=urlsplit(e.get('DATABASE_URL',''))
        if conexion.hostname!='db' or conexion.username!='inventario_app' or conexion.path!='/inventario' or unquote(conexion.password or '')!=d.get('APP_DB_PASSWORD'):
            errores.append('La conexión de la web no coincide con el usuario limitado y la base configurada.')
    except ValueError:
        errores.append('Revisa la conexión de la web a PostgreSQL.')
    volumen=config.get('volumes',{}).get('postgres_data',{}).get('name')
    if not volumen:errores.append('No se pudo identificar el volumen persistente de PostgreSQL.')
    return errores,volumen


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--prueba-local',action='store_true',help='Admite origen HTTP de loopback y volumen nuevo solo en un ensayo aislado.')
    p.add_argument('--env-file',help='Archivo privado que leerá Docker Compose; no se imprime.')
    p.add_argument('--project-name',help='Nombre explícito del proyecto Compose que se revisa.')
    args=p.parse_args()
    raiz=Path(__file__).resolve().parents[1]
    orden=['docker','compose']
    if args.env_file:orden+=['--env-file',args.env_file]
    if args.project_name:orden+=['--project-name',args.project_name]
    orden+=['-f',str(raiz/'compose.produccion.yaml'),'config','--format','json']
    try:
        resultado=subprocess.run(orden,cwd=raiz,capture_output=True,text=True,check=False)
        if resultado.returncode:raise RuntimeError('No se pudo resolver Compose. Revisa las variables requeridas y la disponibilidad de Docker Compose.')
        errores,volumen=revisar(json.loads(resultado.stdout),args.prueba_local)
        if errores:
            for e in errores:print(e,file=sys.stderr)
            return 1
        comprobacion=subprocess.run(['docker','volume','inspect',volumen],capture_output=True,text=True,check=False)
        if comprobacion.returncode and not args.prueba_local:
            print('No existe el volumen esperado. Verifica el nombre del proyecto y el volumen instalado antes de iniciar producción.',file=sys.stderr)
            return 1
        print(('Ensayo local' if args.prueba_local else 'Configuración de producción')+': ejecución y conexión coherentes; comprobar la imagen y la instalación.')
        print('Volumen PostgreSQL: '+volumen)
        print('Volumen persistente identificado'+('; ensayo local con volumen nuevo permitido.' if comprobacion.returncode else ' y presente.'))
        print('No se iniciaron servicios ni se modificaron datos. Falta comprobar HTTPS, OAuth real, respaldo y funcionamiento instalado.')
        return 0
    except (OSError,ValueError,RuntimeError):
        print('No se pudo completar la verificación. Revisa Docker, Compose y la configuración privada; no se imprimieron sus valores.',file=sys.stderr)
        return 1


if __name__=='__main__':sys.exit(main())
