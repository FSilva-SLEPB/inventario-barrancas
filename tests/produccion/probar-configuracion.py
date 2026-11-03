import importlib.util
from pathlib import Path
from copy import deepcopy
raiz=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('preflight',raiz/'scripts/verificar-produccion.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
base={'services':{'web':{'environment':{'NEXTAUTH_URL':'https://inventario.example.org','NEXTAUTH_SECRET':'ficticio-'*8,'GOOGLE_CLIENT_ID':'id-ficticio','GOOGLE_CLIENT_SECRET':'secreto-ficticio','NODE_ENV':'production','DATABASE_URL':'postgresql://inventario_app:clave-app-ficticia@db:5432/inventario'},'read_only':True,'user':'1000:1000','ports':[{'host_ip':'127.0.0.1'}],'cap_drop':['ALL'],'security_opt':['no-new-privileges:true']},'db':{'environment':{'POSTGRES_PASSWORD':'clave-admin-ficticia','APP_DB_PASSWORD':'clave-app-ficticia'}}},'volumes':{'postgres_data':{'name':'ensayo_postgres_data'}}}
assert not mod.revisar(base)[0]
for clave,valor in [('NEXTAUTH_URL','http://inventario.example.org'),('NEXTAUTH_URL','https://usuario:clave@example.org'),('NEXTAUTH_SECRET','corto'),('GOOGLE_CLIENT_SECRET',''),('NODE_ENV','development'),('DATABASE_URL','postgresql://inventario_admin:clave@db:5432/inventario')]:
 c=deepcopy(base);c['services']['web']['environment'][clave]=valor;assert mod.revisar(c)[0],clave
c=deepcopy(base);c['services']['web']['ports'][0]['host_ip']='0.0.0.0';assert mod.revisar(c)[0]
c=deepcopy(base);c['services']['web']['volumes']=[{'source':'./web'}];assert mod.revisar(c)[0]
c=deepcopy(base);c['services']['web']['user']='root';assert mod.revisar(c)[0]
c=deepcopy(base);c['services']['web']['environment']['NEXTAUTH_URL']='http://localhost:3000';assert mod.revisar(c)[0];assert not mod.revisar(c,True)[0]
print('Configuración de producción: origen, secretos, conexión, exposición, ejecución y separación de desarrollo comprobados.')
