// Auditoría reproducible con identidades y base exclusivamente ficticias.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL&&process.env.NEXTAUTH_SECRET);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const id=randomUUID(),payload='<img src=x onerror=alert(1)>',actor='felipe.silva@slepb.gob.cl';
const cookie='next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'auditoria-ficticia',correoInstitucional:actor},maxAge:600});
const pedir=(ruta,c=cookie)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}});
await db.connect();await app.connect();let pruebas=0;
try{
 await app.query('SELECT public.guardar_funcionario_nc_acceso($1,$2::uuid,$3::jsonb,0,$4)',[actor,id,JSON.stringify({nombre:payload,rut:'',correo:'',unidad:'',subdireccion:'',cargo:'',fechaIngreso:'',activo:true}),'Auditoría ficticia de escape']);
 const respuesta=await pedir('/mantenedores/funcionarios?ver='+id),html=await respuesta.text();assert.equal(respuesta.status,200);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes(payload));pruebas++;
 assert.match(respuesta.headers.get('cache-control'),/private/);assert.match(respuesta.headers.get('cache-control'),/no-store/);assert.equal(respuesta.headers.get('x-content-type-options'),'nosniff');assert.equal(respuesta.headers.get('x-frame-options'),'SAMEORIGIN');assert.equal(respuesta.headers.get('x-powered-by'),null);
 const csp=respuesta.headers.get('content-security-policy')??'';assert.match(csp,/default-src 'self'/);assert.match(csp,/object-src 'none'/);assert.match(csp,/frame-ancestors 'self'/);assert.ok(!csp.includes('unsafe-eval'),'producción sin eval');assert.match(respuesta.headers.get('permissions-policy')??'',/camera=\(\)/);pruebas++;
 const formularioHtml=await(await pedir('/mantenedores/funcionarios?editar='+id)).text(),bloque=[...formularioHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(m=>m.includes('formulario-funcionario'));assert.ok(bloque);
 const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&'),f=new FormData();for(const[m]of bloque.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(m)?.[1];if(n&&(n.startsWith('$ACTION')||['id','version'].includes(n)))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(m)?.[1]??''));}
 for(const[k,v]of Object.entries({nombre:'Cambio cruzado no permitido',rut:'',correo:'',unidad:'',subdireccion:'',cargo:'',fechaIngreso:'',activo:'si',motivo:'Solicitud de otro origen'}))f.set(k,v);
 const cruzada=await fetch(origen+'/mantenedores/funcionarios?editar='+id,{method:'POST',redirect:'manual',headers:{Cookie:cookie,Origin:'https://origen-ajeno.invalid'},body:f});assert.ok(cruzada.status>=400);assert.equal((await db.query('SELECT nombre FROM public.funcionarios_nc WHERE id=$1',[id])).rows[0].nombre,payload);pruebas++;
 const caducada='next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticia',correoInstitucional:actor},maxAge:-600});assert.equal((await pedir('/mantenedores/funcionarios?ver='+id,caducada)).headers.get('location'),'/ingresar');pruebas++;
 const inyeccion=await(await pedir('/mantenedores/funcionarios?q='+encodeURIComponent("' OR 1=1 --"))).text();assert.ok(!inyeccion.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!inyeccion.includes('syntax error'));pruebas++;
 const funciones=await db.query("SELECT p.oid::regprocedure::text AS nombre,p.proconfig,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS publica FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef");assert.ok(funciones.rows.length>5);for(const p of funciones.rows){assert.equal(p.publica,false,p.nombre);assert.ok(p.proconfig.some(c=>/^search_path=pg_catalog, ?pg_temp$/.test(c)),p.nombre);}pruebas++;
 const rol=(await app.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];assert.deepEqual(rol,{rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolbypassrls:false});pruebas++;
 const csv=await pedir('/inventario/robos/dashboard/exportar','');assert.equal(csv.headers.get('location'),'/ingresar');assert.ok(!(await csv.text()).includes('TOTAL GLOBAL'));pruebas++;
 console.log(`${pruebas} comprobaciones de seguridad: escape XSS, caché y cabeceras, origen cruzado, sesión caducada, filtros SQL, funciones/rol limitado y exportación privada.`);
}finally{await db.query('DELETE FROM public.funcionarios_nc_historial WHERE funcionario_id=$1',[id]);await db.query('DELETE FROM public.funcionarios_nc WHERE id=$1',[id]);await Promise.all([app.end(),db.end()]);}
