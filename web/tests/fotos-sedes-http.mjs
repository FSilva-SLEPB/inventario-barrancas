// Fotografías persistentes: base y cuentas ficticias, sin archivos del servidor real.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt'),origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.DATABASE_URL&&process.env.TEST_ADMIN_DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL}),suf=randomUUID(),sedes=[randomUUID(),randomUUID()];
const roles={encargado:'encargado',otro:'encargado',consulta:'consulta_sede',auditor:'consulta',gestor:'gestor_insumos',admin:'administrador_gestion'},cuentas=Object.fromEntries(Object.keys(roles).map(k=>[k,'foto-'+k+'-'+suf+'@slepb.gob.cl']));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64');
const cookies={};const get=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:c?{Cookie:c}:{}});
const datos=(sede,id=randomUUID(),version=0,contenido=png,mime='image/png')=>{const f=new FormData();f.set('sede',sede);f.set('solicitud',id);f.set('version',String(version));f.set('imagen',new Blob([contenido],{type:mime}),'foto.png');return f;};
const post=(f,c,origin=new URL(origen).origin)=>fetch(origen+'/api/sedes/foto',{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:origin},body:f});
const guardar=(actor,id,sede,version=0,b=png,cliente=app)=>cliente.query('SELECT public.guardar_fotografia_sede_acceso($1,$2::uuid,$3::uuid,$4,$5,$6::bytea) AS r',[actor,id,sede,version,'image/png',b]);
const codigo=c=>e=>e.code===c;let n=0,foto;
async function caso(nombre,fn){try{await fn();n++;}catch(e){throw new Error('Fotos de sedes: '+nombre,{cause:e});}}
await db.connect();await app.connect();
try{
 for(const[i,id]of sedes.entries())await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,activo) VALUES($1,$2,$3,$4,true)',[id,i?'jardin_infantil':'establecimiento','Foto sede '+i+' '+suf,'FOTO-'+i+'-'+suf]);
 for(const[k,rol]of Object.entries(roles)){await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5)',['felipe.silva@slepb.gob.cl',cuentas[k],'Persona ficticia',rol,['encargado','consulta_sede'].includes(rol)?sedes[k==='otro'?1:0]:null]);cookies[k]='next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:cuentas[k]},maxAge:900});}
 await caso('Datos del establecimiento y fotografía con permisos de edición por sede',async()=>{
  const h=await(await get('/',cookies.encargado)).text();assert.match(h,/Datos del establecimiento/);assert.doesNotMatch(h,/Subir fotografía/);assert.match(h,/Sin fotografía/);assert.doesNotMatch(await(await get('/',cookies.consulta)).text(),/Subir fotografía/);
  for(const k of ['admin','gestor']){const h=await(await get('/',cookies[k])).text();assert.match(h,/Gestor de insumos/);assert.match(h,/href="\/insumos\/seguimiento"/);assert.doesNotMatch(h,/Datos del establecimiento/);}
 });
 await caso('subida HTTP guarda bytes y autor, con repetición idempotente',async()=>{
  const id=randomUUID(),r=await post(datos(sedes[0],id),cookies.admin);assert.equal(r.status,200);foto=await r.json();assert.equal(foto.id,id);assert.equal(foto.version,1);const r2=await post(datos(sedes[0],id),cookies.admin);assert.equal(r2.status,200);assert.equal((await r2.json()).repetida,true);
  const rows=(await db.query('SELECT * FROM public.fotografias_sedes WHERE sede_id=$1',[sedes[0]])).rows;assert.equal(rows.length,1);assert.equal(rows[0].actor,cuentas.admin);assert.deepEqual(rows[0].contenido,png);
 });
 await caso('lectura propia con caché privada, consulta de sede y tipos de imagen seguros',async()=>{
  for(const k of ['encargado','consulta','admin','auditor']){const r=await get('/api/sedes/foto?id='+foto.id,cookies[k]);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.match(r.headers.get('cache-control'),/private, no-store/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await r.arrayBuffer()),png);}
  assert.match(await(await get('/',cookies.consulta)).text(),new RegExp('/api/sedes/foto\\?id='+foto.id));
 });
 await caso('aislamiento: otra sede y el gestor no leen ni cambian fotografías ajenas',async()=>{
  assert.equal((await get('/api/sedes/foto?id='+foto.id,cookies.otro)).status,404);assert.equal((await get('/api/sedes/foto?id='+foto.id,cookies.gestor)).status,403);assert.equal((await get('/api/sedes/foto?id='+foto.id)).status,401);
  for(const k of ['encargado','consulta','auditor','gestor']){assert.equal((await post(datos(sedes[0]),cookies[k])).status,403);await assert.rejects(guardar(cuentas[k],randomUUID(),sedes[0]),codigo('42501'));}
  assert.equal((await post(datos(sedes[1]),cookies.encargado)).status,403);await assert.rejects(guardar(cuentas.encargado,randomUUID(),sedes[1]),codigo('42501'));
 });
 await caso('origen cruzado, formatos, tamaños y formularios inválidos no guardan filas',async()=>{
  const antes=Number((await db.query('SELECT count(*) n FROM public.fotografias_sedes')).rows[0].n);
  assert.equal((await post(datos(sedes[0]),cookies.admin,'https://otro.example.org')).status,403);
  for(const f of [datos(sedes[0],randomUUID(),1,Buffer.from('<svg onload="alert(1)"/>'),'image/svg+xml'),datos(sedes[0],randomUUID(),1,Buffer.from('contenido falso'),'image/png'),datos(sedes[0],randomUUID(),1,Buffer.alloc(5*1024*1024+1),'image/png')])assert.equal((await post(f,cookies.admin)).status,400);
  const f=datos(sedes[0]);f.append('sede',sedes[1]);assert.equal((await post(f,cookies.admin)).status,400);const extra=datos(sedes[0]);extra.set('actor',cuentas.admin);assert.equal((await post(extra,cookies.admin)).status,400);assert.equal(Number((await db.query('SELECT count(*) n FROM public.fotografias_sedes')).rows[0].n),antes);
  await assert.rejects(guardar(cuentas.admin,randomUUID(),sedes[0],1,Buffer.from('fotografia inválida')),codigo('23514'));
 });
 await caso('versión obsoleta y reutilización de UUID con otros datos no sobrescriben',async()=>{
  assert.equal((await post(datos(sedes[0],randomUUID(),0),cookies.admin)).status,409);assert.equal((await post(datos(sedes[0],foto.id,0,Buffer.concat([png,Buffer.from('otro') ])),cookies.admin)).status,409);assert.equal((await db.query('SELECT max(version) v FROM public.fotografias_sedes WHERE sede_id=$1',[sedes[0]])).rows[0].v,1);
 });
 await caso('dos subidas concurrentes preservan una sola versión y conservan la anterior',async()=>{
  const clientes=[new pg.Client({connectionString:process.env.DATABASE_URL}),new pg.Client({connectionString:process.env.DATABASE_URL})];await Promise.all(clientes.map(c=>c.connect()));
  try{const r=await Promise.allSettled(clientes.map((c,i)=>guardar(cuentas.admin,randomUUID(),sedes[0],1,Buffer.concat([png,Buffer.from(String(i))]),c)));assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(r.filter(x=>x.status==='rejected'&&x.reason.code==='P3402').length,1);}finally{await Promise.all(clientes.map(c=>c.end()));}
  assert.deepEqual(Buffer.from(await(await get('/api/sedes/foto?id='+foto.id,cookies.encargado)).arrayBuffer()),png);assert.equal((await db.query('SELECT count(*)::int n FROM public.fotografias_sedes WHERE sede_id=$1',[sedes[0]])).rows[0].n,2);
 });
 await caso('administración central puede subir para un jardín; el rol app no escribe directamente',async()=>{
  const r=await post(datos(sedes[1]),cookies.admin);assert.equal(r.status,200);const h=await(await get('/',cookies.otro)).text();assert.match(h,new RegExp((await r.json()).id));for(const sql of ['UPDATE public.fotografias_sedes SET actor=actor WHERE false','DELETE FROM public.fotografias_sedes WHERE false','TRUNCATE public.fotografias_sedes'])await assert.rejects(app.query(sql),codigo('42501'));
 });
 await caso('cambio de sede y desactivación revocan lectura y escritura en la siguiente petición',async()=>{
  const u=(await db.query('SELECT version FROM public.usuarios_acceso WHERE correo=$1',[cuentas.encargado])).rows[0];await app.query("SELECT public.guardar_usuario_acceso($1,$2,'Persona ficticia','encargado',true,$3,$4)",['felipe.silva@slepb.gob.cl',cuentas.encargado,u.version,sedes[1]]);assert.equal((await get('/api/sedes/foto?id='+foto.id,cookies.encargado)).status,404);await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=$1',[cuentas.encargado]);assert.equal((await post(datos(sedes[1]),cookies.encargado)).status,401);await assert.rejects(guardar(cuentas.encargado,randomUUID(),sedes[1],1),codigo('42501'));
 });
 console.log(`Fotografías de sedes: ${n} escenarios SQL/HTTP aprobados: bytes persistentes, versiones, reintentos, concurrencia, ámbito, MIME/tamaño, permisos, revocación y acceso visible al gestor.`);
}finally{await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=ANY($1::text[])',[Object.values(cuentas)]);await app.end();await db.end();}
