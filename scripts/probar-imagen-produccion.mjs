// Ensayo aislado: requiere base, red e identidades exclusivamente de prueba.
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const raiz=fileURLToPath(new URL('../',import.meta.url));
const imagen=process.env.PRUEBA_IMAGEN,dbContenedor=process.env.PRUEBA_DB_CONTAINER;
assert.ok(imagen&&dbContenedor&&process.env.DATABASE_URL&&process.env.TEST_ADMIN_DATABASE_URL,'Indica imagen y base aislada de prueba.');
const docker=(args,permitirFallo=false)=>{const r=spawnSync('docker',args,{encoding:'utf8',cwd:raiz});if(r.status!==0&&!permitirFallo)throw new Error('Falló una operación Docker del ensayo; revisa su disponibilidad y recursos de prueba.');return r;};
const info=JSON.parse(docker(['inspect',dbContenedor]).stdout)[0],redes=Object.keys(info.NetworkSettings.Networks),red=redes.find(n=>/prueba|test|github/i.test(n));
assert.ok(red,'Usar una red identificada como prueba, test o github. No se admite una red de producción.');
const conexion=new URL(process.env.DATABASE_URL);conexion.hostname='db';conexion.port='5432';
const clave=randomBytes(32).toString('hex'),nombre='codex-imagen-prueba-'+randomUUID().slice(0,8),creados=[];
const puerto=await new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const origen='http://127.0.0.1:'+puerto,canonico='http://localhost:'+puerto;
const temporal=await mkdtemp(join(tmpdir(),'inventario-imagen-prueba-'));
function iniciar(sufijo,extra={},publicar=false){
 const n=nombre+sufijo,e={NEXTAUTH_URL:canonico,NEXTAUTH_SECRET:clave,GOOGLE_CLIENT_ID:'id-ficticio',GOOGLE_CLIENT_SECRET:'secreto-ficticio',DATABASE_URL:conexion.toString(),...extra};
 const args=['run','--detach','--name',n,'--network',red,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--tmpfs','/tmp:uid=1000,gid=1000,mode=1777','--tmpfs','/app/.next/cache:uid=1000,gid=1000,mode=0750'];
 if(publicar)args.push('--publish','127.0.0.1:'+puerto+':3000');
 for(const[k,v]of Object.entries(e))args.push('--env',k+'='+v);
 args.push(imagen);docker(args);creados.push(n);return n;
}
function retirar(n){docker(['stop','--time','5',n],true);docker(['rm',n],true);const i=creados.indexOf(n);if(i>=0)creados.splice(i,1);}
async function esperar(url,estado){let ultima;for(let i=0;i<80;i++){try{ultima=await fetch(url,{signal:AbortSignal.timeout(3000)});if(ultima.status===estado)return ultima;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('La imagen no alcanzó el estado HTTP esperado.');}
async function comprobarFallo(contenedor){
 for(let i=0;i<60;i++){
  const r=docker(['exec',contenedor,'node','-e',"fetch('http://127.0.0.1:3000/api/salud').then(async r=>{const b=await r.json();if(r.status!==503||JSON.stringify(b)!==JSON.stringify({estado:'no_disponible'}))process.exit(1)}).catch(()=>process.exit(1))"],true);
  if(r.status===0)return;await new Promise(r=>setTimeout(r,200));
 }
 throw new Error('La imagen incompleta no rechazó la comprobación de salud como se esperaba.');
}
try{
 const principal=iniciar('',{REVISION_SIN_OAUTH:'1'},true),salud=await esperar(origen+'/api/salud',200);assert.deepEqual(await salud.json(),{estado:'ok'});
 const cmd=JSON.parse(docker(['inspect','--format','{{json .Config.Cmd}}',principal]).stdout);assert.deepEqual(cmd,['node','server.js']);
 docker(['exec',principal,'node','-e',"const fs=require('fs');if(process.getuid()!==1000)process.exit(1);let bloqueado=false;try{fs.writeFileSync('/app/escritura-no-permitida','prueba')}catch(e){bloqueado=['EROFS','EACCES'].includes(e.code)}if(!bloqueado)process.exit(1);fs.writeFileSync('/tmp/prueba-imagen','ok');fs.writeFileSync('/app/.next/cache/prueba-imagen','ok')"]);
 console.log('Imagen compilada: usuario no privilegiado, raíz de solo lectura, caché temporal y salud comprobados.');
 // Los identificadores de acciones pertenecen a esta compilación, no a la del host.
 const metadatos=docker(['exec',principal,'node','-e',"const fs=require('fs');const m=JSON.parse(fs.readFileSync('/app/.next/server/server-reference-manifest.json','utf8'));console.log(JSON.stringify({node:Object.fromEntries(Object.entries(m.node).map(([id,a])=>[id,{exportedName:a.exportedName,filename:a.filename}]))}))"]).stdout;
 const manifiesto=join(temporal,'acciones.json');await writeFile(manifiesto,metadatos,{mode:0o600});
 const entorno={...process.env,NEXTAUTH_URL:canonico,NEXTAUTH_SECRET:clave,GOOGLE_CLIENT_ID:'id-ficticio',GOOGLE_CLIENT_SECRET:'secreto-ficticio',ACCESO_HTTP_URL:origen,TEST_ACTION_MANIFEST:manifiesto};
 const archivos=['acceso','perfiles','equipos','entregas','directorio','directorio-completo','robos','experiencia','funcionarios','produccion','seguridad','directorios-separados','celulares','movimientos-inventario','actas','actas-historicas','operacion-acta','prestamos','operaciones-inventario','estados-inventario','insumos','ubicaciones-bodega','compras-insumos','gestor-insumos','inicio-sede','fotos-sedes','reportes-incidentes','rbac','carga-completa','gestor-dashboard'];
 for(const a of archivos){const p=spawn(process.execPath,['tests/'+a+'-http.mjs'],{cwd:raiz+'web',env:entorno,stdio:'inherit'});const codigo=await new Promise(r=>p.once('exit',r));assert.equal(codigo,0,'Falló prueba de imagen: '+a);}
 retirar(principal);
 const sinConfig=iniciar('-config',{NEXTAUTH_URL:'http://ejemplo-no-permitido.invalid'});await comprobarFallo(sinConfig);retirar(sinConfig);
 const malaConexion=new URL(conexion);malaConexion.password='clave-ficticia-incorrecta';const sinBase=iniciar('-base',{DATABASE_URL:malaConexion.toString()});await comprobarFallo(sinBase);retirar(sinBase);
 console.log('Imagen rechaza configuración y conexión incompletas con HTTP 503 sin publicar detalles. Ensayo de producción correcto.');
}finally{
 for(const n of creados.reverse()){docker(['stop','--time','5',n],true);docker(['rm',n],true);}
 await rm(temporal,{recursive:true,force:true});
}
