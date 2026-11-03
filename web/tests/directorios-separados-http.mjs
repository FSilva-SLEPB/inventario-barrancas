// Solo una instancia aislada, datos sintéticos y sesiones ficticias.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readdir} from 'node:fs/promises';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.NEXTAUTH_SECRET&&process.env.DATABASE_URL&&process.env.TEST_ADMIN_DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
await db.connect();await app.connect();
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID()],cat=randomUUID(),dep=randomUUID(),equipos=[];
const admin='separado-'+sufijo+'@slepb.gob.cl',consulta='lectura-separado-'+sufijo+'@slepb.gob.cl',local='local-separado-'+sufijo+'@slepb.gob.cl';
const rutas=['/directorio/establecimientos','/directorio/directores','/directorio/jardines','/directorio/directoras'];
const cookie=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticia',correoInstitucional:email},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}});
const enviar=(ruta,f,c)=>fetch(origen+ruta,{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:new URL(origen).origin},body:f});
const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function formulario(html,marca='formulario-directorio-seccion'){
 const bloque=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(v=>v.includes(marca));assert.ok(bloque,'Formulario '+marca);
 const f=new FormData();for(const[m]of bloque.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(m)?.[1];if(n&&!/type="(?:file|checkbox|radio)"/.test(m))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(m)?.[1]??''));}
 for(const[,n,cuerpo]of bloque.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const opciones=[...cuerpo.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)],o=opciones.find(o=>/\bselected\b/.test(o[1]))??opciones[0];if(o)f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(o[1])?.[1]??o[2]));}
 for(const[,n,v]of bloque.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))f.append(dec(n),dec(v));return f;
}
const director=async i=>(await db.query('SELECT * FROM public.directorio_sedes WHERE sede_id=$1',[sedes[i]])).rows[0];
const sede=async i=>(await db.query('SELECT * FROM public.sedes WHERE id=$1',[sedes[i]])).rows[0];
const numeroHistorial=async i=>Number((await db.query('SELECT count(*) AS n FROM public.directorio_historial WHERE sede_id=$1',[sedes[i]])).rows[0].n);
let pruebas=0;
try{
 // Ensayo de actualización de una base anterior: nunca inferir nombres/apellidos.
 const nombreDb='codex_prueba_directorio_'+randomUUID().replaceAll('-',''),url=new URL(process.env.TEST_ADMIN_DATABASE_URL);url.pathname='/'+nombreDb;let anterior;
 try{
  await db.query('CREATE DATABASE "'+nombreDb+'"');anterior=new pg.Client({connectionString:url.toString()});await anterior.connect();
  const archivos=(await readdir(new URL('../migrations',import.meta.url))).filter(n=>n.endsWith('.mjs')).sort();
  for(const archivo of archivos.filter(n=>n<'1794096000000')){const sql=[];(await import('../migrations/'+archivo)).up({sql:s=>sql.push(s)});for(const s of sql)await anterior.query(s);}
  const id=(await anterior.query("INSERT INTO public.sedes(tipo,nombre,rbd) VALUES('establecimiento','Sede ficticia anterior','PRUEBA-LEGADO') RETURNING id")).rows[0].id;
  await anterior.query('SELECT public.guardar_director_acceso($1,$2,$3,0,$4)',['felipe.silva@slepb.gob.cl',id,'María del Carmen De la Cruz Soto','Nombre original de prueba']);
  const antes=(await anterior.query('SELECT nombre,version FROM public.directorio_sedes WHERE sede_id=$1',[id])).rows[0],sql=[];(await import('../migrations/1794096000000_directorios-separados.mjs')).up({sql:s=>sql.push(s)});for(const s of sql)await anterior.query(s);
  const despues=(await anterior.query('SELECT nombre,version,nombres,apellidos FROM public.directorio_sedes WHERE sede_id=$1',[id])).rows[0];assert.equal(despues.nombre,antes.nombre);assert.equal(despues.version,antes.version);assert.equal(despues.nombres,null);assert.equal(despues.apellidos,null);assert.equal((await anterior.query('SELECT count(*) AS n FROM public.directorio_historial WHERE sede_id=$1',[id])).rows[0].n,'1');pruebas++;
 }finally{if(anterior)await anterior.end();await db.query('DROP DATABASE IF EXISTS "'+nombreDb+'"');}
 for(let i=0;i<2;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna,direccion,correo_institucional) VALUES($1,$2,$3,$4,$5,$6,$7)',[sedes[i],i?'jardin_infantil':'establecimiento',(i?'Jardín separado ':'Escuela separada ')+sufijo,'SEP-'+i+'-'+sufijo,'Pudahuel','Dirección original','institucional-'+i+'@example.org']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[cat,'Categoría separada '+sufijo]);await db.query('INSERT INTO public.dependencias(id,sede_id,nombre) VALUES($1,$2,$3)',[dep,sedes[0],'Dependencia separada '+sufijo]);
 for(const[email,rol,s]of [[admin,'administrador_gestion',null],[consulta,'consulta',null],[local,'encargado',sedes[0]]])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',email,'Persona ficticia',rol,s]);
 await app.query('SELECT public.guardar_director_acceso($1,$2,$3,0,$4)',[admin,sedes[0],'Nombre completo de legado','Registro ficticio']);
 const ca=await cookie(admin),cc=await cookie(consulta),cl=await cookie(local);
 const columnas=[['RBD','Nombre','Dirección','Comuna','Correo electrónico','Ficha'],['RBD','Establecimiento','RUN','Nombres Director/a','Apellidos','Correo electrónico','Estado contractual','Ficha'],['RBD','Nombre','Dirección','Comuna','Correo electrónico','Ficha'],['RBD','Jardín','RUN','Nombres Director/a','Apellidos','Estado contractual','Ficha']];
 for(let i=0;i<rutas.length;i++){
  const html=await(await pedir(rutas[i]+'?q='+sufijo,ca)).text(),tabla=/<table\b[^>]*class="[^"]*tabla-directorio-separado[\s\S]*?<\/table>/.exec(html)?.[0];assert.ok(tabla);assert.deepEqual([...tabla.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(m=>m[1]),columnas[i]);assert.ok(tabla.includes((i<2?'Escuela separada ':'Jardín separado ')+sufijo));assert.ok(!tabla.includes((i<2?'Jardín separado ':'Escuela separada ')+sufijo));assert.ok(!tabla.includes('editar='));assert.equal((tabla.match(/<a\b/g)||[]).length,1);assert.equal((tabla.match(/>Ver ficha<\/a>/g)||[]).length,1);assert.ok(!tabla.includes('ficha-directorio-enlace'));
  for(const c of [cc,cl])assert.equal((await pedir(rutas[i]+'?ver='+sedes[0],c)).headers.get('location'),'/sin-permiso');
 }pruebas+=2;
 const redireccionAnterior=await pedir('/mantenedores/directores-establecimientos?q='+sufijo+'&ver='+sedes[0],ca);assert.equal(redireccionAnterior.status,307);const destinoAnterior=new URL(redireccionAnterior.headers.get('location'),origen);assert.equal(destinoAnterior.pathname,'/directorio/directores');assert.equal(destinoAnterior.searchParams.get('q'),sufijo);assert.equal(destinoAnterior.searchParams.get('ver'),sedes[0]);assert.equal((await pedir('/mantenedores/directores',ca)).headers.get('location'),'/directorio');pruebas++;
 const legado=await(await pedir(rutas[1]+'?ver='+sedes[0],ca)).text();assert.ok(legado.includes('Nombre completo pendiente de separar'));assert.ok(legado.includes('Nombre completo de legado'));assert.equal((await director(0)).nombres,null);pruebas++;
 const equivocada=await pedir(rutas[3]+'?ver='+sedes[0],ca);assert.equal(equivocada.status,404);pruebas++;
 const urlSede=rutas[0]+'?q='+sufijo+'&editar='+sedes[0],fSede=formulario(await(await pedir(urlSede,ca)).text());assert.equal(fSede.has('nombres'),false);const vieja=new FormData();for(const[k,v]of fSede)vieja.append(k,v);
 fSede.set('direccion','Dirección actualizada');fSede.set('rbd','SEP-NUEVO-'+sufijo.slice(0,8));fSede.set('correoInstitucional','SEDE@EXAMPLE.ORG');fSede.set('nombres','Campo no permitido');const invalida=await enviar(urlSede,fSede,ca);assert.equal(invalida.status,200);assert.equal((await sede(0)).direccion,'Dirección original');pruebas++;
 fSede.delete('nombres');const guardada=await enviar(urlSede,fSede,ca);assert.equal(guardada.status,303);assert.ok(!guardada.headers.get('location').includes('editar='));assert.ok(guardada.headers.get('location').includes('q='+sufijo));const fichaSede=await(await pedir(guardada.headers.get('location'),ca)).text();assert.ok(!fichaSede.includes('class="formulario-directorio'));assert.ok(fichaSede.includes('Dirección actualizada'));assert.equal((await sede(0)).correo_institucional,'sede@example.org');assert.equal((await director(0)).nombre,'Nombre completo de legado');pruebas++;
 vieja.set('direccion','Cambio obsoleto');assert.equal((await enviar(urlSede,vieja,ca)).status,200);assert.equal((await sede(0)).direccion,'Dirección actualizada');pruebas++;
 const urlPersona=rutas[1]+'?q='+sufijo+'&editar='+sedes[0],fPersona=formulario(await(await pedir(urlPersona,ca)).text());for(const[k,v]of Object.entries({situacion:'titular',nombres:'María',apellidos:'De la Cruz Soto',rut:'12345678-5',correo:'directora@example.org'}))fPersona.set(k,v);
 const guardadaPersona=await enviar(urlPersona,fPersona,ca);assert.equal(guardadaPersona.status,303);assert.ok(guardadaPersona.headers.get('location').includes('ver='+sedes[0]));const persona=await director(0);assert.equal(persona.nombres,'María');assert.equal(persona.apellidos,'De la Cruz Soto');assert.equal(persona.nombre,'María De la Cruz Soto');assert.equal((await sede(0)).direccion,'Dirección actualizada');const fichaPersona=await(await pedir(guardadaPersona.headers.get('location'),ca)).text();assert.ok(!fichaPersona.includes('class="formulario-directorio'));pruebas++;
 const n=await numeroHistorial(0);assert.equal((await enviar(urlPersona,fPersona,ca)).status,200);assert.equal(await numeroHistorial(0),n);pruebas++;
 const cruzada=formulario(await(await pedir(urlPersona,ca)).text());cruzada.set('seccion','directoras');assert.equal((await enviar(urlPersona,cruzada,ca)).status,200);assert.equal(await numeroHistorial(0),n);pruebas++;
 const mala=formulario(await(await pedir(urlPersona,ca)).text());mala.set('rut','12345678-9');mala.set('nombres','Texto conservado');const error=await enviar(urlPersona,mala,ca);assert.equal(error.status,200);const texto=await error.text();assert.ok(texto.includes('Texto conservado'));assert.ok(texto.includes('Revisa el dígito'));assert.equal(await numeroHistorial(0),n);pruebas++;
 await app.query('SELECT public.guardar_director_acceso($1,$2,$3,$4,$5)',[admin,sedes[0],persona.nombre,persona.version,'Compatibilidad de prueba']);assert.equal((await director(0)).apellidos,'De la Cruz Soto');pruebas++;
 const vacante=formulario(await(await pedir(urlPersona,ca)).text());for(const k of ['nombres','apellidos','rut','correo'])vacante.set(k,'');vacante.set('situacion','vacante');assert.equal((await enviar(urlPersona,vacante,ca)).status,303);const vacio=await director(0);for(const k of ['nombre','nombres','apellidos','rut','correo'])assert.equal(vacio[k],null);const historia=await db.query('SELECT antes,despues FROM public.directorio_historial WHERE sede_id=$1 ORDER BY registrado_en DESC,id DESC LIMIT 1',[sedes[0]]);assert.equal(historia.rows[0].antes.apellidos,'De la Cruz Soto');pruebas++;
 const urlJI=rutas[3]+'?editar='+sedes[1],ji=formulario(await(await pedir(urlJI,ca)).text());assert.equal(ji.has('correo'),false);for(const[k,v]of Object.entries({situacion:'subrogante',nombres:'Persona',apellidos:'De ejemplo',rut:''}))ji.set(k,v);assert.equal((await enviar(urlJI,ji,ca)).status,303);assert.equal((await director(1)).nombre,'Persona De ejemplo');pruebas++;
 const sinPermiso=formulario(await(await pedir(urlPersona,ca)).text());sinPermiso.set('situacion','pendiente');for(const k of ['nombres','apellidos','rut','correo'])sinPermiso.set(k,'');assert.equal((await enviar(urlPersona,sinPermiso,cc)).headers.get('location'),'/sin-permiso');pruebas++;
 const mant=await(await pedir('/mantenedores',ca)).text();assert.ok(!mant.includes('/mantenedores/modelo-datos'));assert.ok(!/<main[\s\S]*?<\/main>/.exec(mant)?.[0].includes('href="/directorio'));assert.ok(!mant.includes('/documentacion/modelo-datos'));assert.equal((await pedir('/mantenedores/modelo-datos',ca)).headers.get('location'),'/documentacion/modelo-datos');assert.equal((await pedir('/documentacion/modelo-datos',cc)).headers.get('location'),'/sin-permiso');pruebas++;
 const celulares=await(await pedir('/inventario/celulares',cl)).text(),principal=/<main\b[^>]*>[\s\S]*?<\/main>/.exec(celulares)?.[0];assert.ok(principal.includes('Gestión pendiente de definir'));assert.ok(!principal.includes('<form'));pruebas++;
 for(const[modulo,id,campos]of [
  ['categorias',cat,{id:cat,nombre:'Categoría editada '+sufijo,activo:'true'}],
  ['sedes',sedes[0],{id:sedes[0],tipo:'establecimiento',nombre:(await sede(0)).nombre,rbd:(await sede(0)).rbd,direccion:'Dirección sede editada',comuna:'Pudahuel',correoInstitucional:'sede@example.org',activo:'true'}],
  ['dependencias',dep,{id:dep,sedeId:sedes[0],nombre:'Dependencia editada '+sufijo,activo:'true'}],
 ]){
  const ruta='/mantenedores/'+modulo+'?editar='+id,f=formulario(await(await pedir(ruta,ca)).text(),'formulario-catalogos');for(const[k,v]of Object.entries(campos))f.set(k,v);const r=await enviar(ruta,f,ca);assert.equal(r.status,303,modulo);const destino=r.headers.get('location');assert.equal(destino,'/mantenedores/'+modulo+'?guardado=1');const html=await(await pedir(destino,ca)).text();assert.ok(!html.includes('class="formulario-catalogos"'));pruebas++;
 }
 const equipo=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[admin,JSON.stringify({id:'',sedeId:sedes[0],categoriaId:cat,marca:'Marca ficticia',modelo:'Modelo ficticio',serie:'SEP-S-'+sufijo,inventario:'SEP-I-'+sufijo,motivoIdentificacion:'',origen:'compra_sede',condicionTecnica:'sin_verificar',compra:{},observaciones:''}),'Registro ficticio'])).rows[0].id;equipos.push(equipo);
 const urlEquipo='/inventario/'+equipo+'?editar=si',fe=formulario(await(await pedir(urlEquipo,ca)).text(),'formulario-equipo');fe.set('modelo','Modelo actualizado');fe.set('motivoCambio','Edición de prueba');const equipoGuardado=await enviar(urlEquipo,fe,ca);assert.equal(equipoGuardado.status,303);assert.equal(equipoGuardado.headers.get('location'),'/inventario/'+equipo+'?guardado=1');assert.ok(!(await(await pedir(equipoGuardado.headers.get('location'),ca)).text()).includes('id="editar-equipo"'));pruebas++;
 console.log(`${pruebas} comprobaciones de directorios separados: actualización con datos anteriores, cuatro tablas, permisos, ámbito, nombres, contactos, edición, versiones, historial, documentación y celulares pendientes.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.equipos WHERE id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.dependencias WHERE id=$1',[dep]);await db.query('DELETE FROM public.directorio_historial WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_sedes WHERE sede_id=ANY($1::uuid[])',[sedes]);const correos=[admin,consulta,local];await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);await Promise.all([db.end(),app.end()]);
}
