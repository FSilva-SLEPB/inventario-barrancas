// Pruebas de navegación, directorio y reportes mínimos con datos ficticios.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {leerModeloDatos,modeloMermaid} from '../src/lib/esquema-base.ts';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID()],cat=randomUUID(),equipos=[],incidentes=[],hashes=[];
const admin=`ux-admin-${sufijo}@slepb.gob.cl`,consulta=`ux-consulta-${sufijo}@slepb.gob.cl`,encargado=`ux-local-${sufijo}@slepb.gob.cl`;
const cookie=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:email},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}}),main=h=>/<main\b[^>]*>[\s\S]*?<\/main>/.exec(h)?.[0]??'';
const cargar=(actor,texto,confirmar=false)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,['scripts/cargar-directorio.mjs','--actor',actor,...(confirmar?['--confirmar']:[])],{env:process.env,stdio:['pipe','pipe','pipe']});let salida='',error='';p.stdout.on('data',s=>salida+=s);p.stderr.on('data',s=>error+=s);p.once('error',reject);p.once('close',code=>resolve({code,salida,error}));p.stdin.end(texto);});
let pruebas=0;await db.connect();await app.connect();
try{
 for(let i=0;i<2;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna) VALUES($1,$2,$3,$4,$5)',[sedes[i],i?'establecimiento':'jardin_infantil','Sede UX '+i+' '+sufijo,'UX-'+i+'-'+sufijo,'Pudahuel']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[cat,'Categoría UX '+sufijo]);
 for(const[email,rol,sede]of [[admin,'administrador_gestion',null],[consulta,'consulta',null],[encargado,'encargado',sedes[0]]])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',email,'Persona ficticia',rol,sede]);
 const ca=await cookie(admin),cc=await cookie(consulta),cl=await cookie(encargado);
 const inventario=await(await pedir('/inventario',ca)).text();assert.ok(!main(inventario).includes('/mantenedores/directores'));assert.ok(inventario.includes('aria-controls="submenu-inventario"'));assert.ok(inventario.includes('href="/directorio/establecimientos"'));pruebas++;
 const mant=main(await(await pedir('/mantenedores',ca)).text());for(const ruta of ['funcionarios','usuarios','categorias','sedes','dependencias'])assert.ok(mant.includes('href="/mantenedores/'+ruta+'"'));assert.ok(!mant.includes('href="/directorio'));pruebas++;
 const mantConsulta=main(await(await pedir('/mantenedores',cc)).text());for(const ruta of ['funcionarios','usuarios','modelo-datos'])assert.ok(!mantConsulta.includes('/mantenedores/'+ruta));assert.ok(!(await(await pedir('/inventario',cc)).text()).includes('href="/directorio"'));pruebas++;
 const portal=main(await(await pedir('/directorio',ca)).text());for(const ruta of ['establecimientos','directores','jardines','directoras'])assert.ok(portal.includes('href="/directorio/'+ruta+'"'));assert.equal((portal.match(/class="acceso-modulo"/g)||[]).length,4);for(const c of [cc,cl])assert.equal((await pedir('/directorio',c)).headers.get('location'),'/sin-permiso');pruebas++;

 const pendientes=main(await(await pedir('/directorio/directores?q='+sufijo+'&situacion=pendiente',ca)).text());assert.match(pendientes.replace(/<!--[\s\S]*?-->/g,''),/<caption[^>]*>1 de \d+ establecimientos/);pruebas++;
 const sinCargar=main(await(await pedir('/directorio/directoras?q='+sufijo+'&situacion=pendiente',ca)).text());assert.match(sinCargar.replace(/<!--[\s\S]*?-->/g,''),/<caption[^>]*>1 de \d+ jardines/);pruebas++;
 const listado=main(await(await pedir('/directorio/establecimientos',ca)).text());const tabla=/<table\b[^>]*class="[^"]*tabla-directorio[^"]*"[\s\S]*?<\/table>/.exec(listado)?.[0];assert.ok(tabla);assert.ok(tabla.includes('editar='));assert.ok(!tabla.includes('RUN'));assert.ok(listado.includes('/directorio/cargar'));pruebas++;
 for(const ruta of ['/mantenedores/modelo-datos','/directorio/cargar']){assert.equal((await pedir(ruta,cc)).headers.get('location'),'/sin-permiso');assert.equal((await pedir(ruta,cl)).headers.get('location'),'/sin-permiso');pruebas++;}
 const texto='RBD\tDIRECTOR/A\tRUT DIRECTOR/A\tCORREOS PERSONALES\tTIPO DE CESE\nUX-0-'+sufijo+'\tResponsable UX de ejemplo\t12345678-5\tresponsable@example.org\tSUBDORGANCIA';hashes.push(createHash('sha256').update(texto).digest('hex'));
 const vista=await cargar(admin,texto);assert.equal(vista.code,0,vista.error);assert.ok(vista.salida.includes('"establecimientosJISC": 1'));assert.equal((await db.query('SELECT count(*) FROM public.directorio_sedes WHERE sede_id=$1',[sedes[0]])).rows[0].count,'0');pruebas++;
 const noAutorizado=await cargar(consulta,texto,true);assert.notEqual(noAutorizado.code,0);pruebas++;
 const cargado=await cargar(admin,texto,true);assert.equal(cargado.code,0,cargado.error);assert.ok(!cargado.salida.includes('12345678-5')&&!cargado.salida.includes('responsable@example.org'));assert.equal((await db.query('SELECT nombre FROM public.directorio_sedes WHERE sede_id=$1',[sedes[0]])).rows[0].nombre,'Responsable UX de ejemplo');pruebas++;
 assert.equal((await cargar(admin,texto,true)).code,0);assert.equal((await db.query('SELECT count(*) FROM public.directorio_historial WHERE sede_id=$1',[sedes[0]])).rows[0].count,'1');pruebas++;
 const ficha=main(await(await pedir('/directorio/directoras?ver='+sedes[0],ca)).text());for(const valor of ['Responsable UX de ejemplo','12345678-5','Editar registro'])assert.ok(ficha.includes(valor));pruebas++;
 for(let i=0;i<2;i++){const id=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[admin,JSON.stringify({id:'',sedeId:sedes[i],categoriaId:cat,marca:'Marca UX',modelo:'Modelo UX',serie:'UX-S-'+i+'-'+sufijo,inventario:'UX-I-'+i+'-'+sufijo,motivoIdentificacion:'',origen:'compra_sede',condicionTecnica:'sin_verificar',compra:{},observaciones:''}),'Registro ficticio'])).rows[0].id;equipos.push(id);}
 const busqueda=main(await(await pedir('/inventario/robos/reportar?q='+sufijo,ca)).text());assert.ok(busqueda.includes('UX-I-0-'+sufijo)&&busqueda.includes('UX-I-1-'+sufijo));pruebas++;
 const local=main(await(await pedir('/inventario/robos/reportar?q='+sufijo,cl)).text());assert.ok(local.includes('UX-I-0-'+sufijo));assert.ok(!local.includes('UX-I-1-'+sufijo));pruebas++;
 const url='/inventario/robos/reportar?equipo='+equipos[0],formulario=await(await pedir(url,ca)).text();assert.ok(formulario.includes('Datos del robo'));const form=[...formulario.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(m=>m.includes('class="formulario-reporte-robo"'));assert.ok(form);
 const f=new FormData(),dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');for(const[m]of form.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(m)?.[1];if(n?.startsWith('$ACTION'))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(m)?.[1]??''));}
 const incidente=randomUUID();incidentes.push(incidente);for(const[k,v]of Object.entries({solicitud:incidente,sedeId:sedes[0],fecha:'2026-10-20',lugar:'',descripcion:'Descripción mínima ficticia',enlace:''}))f.set(k,v);f.set('equipo',JSON.stringify({id:equipos[0],version:1}));const respuesta=await fetch(origen+url,{method:'POST',redirect:'manual',headers:{Cookie:ca,Origin:new URL(origen).origin},body:f});assert.ok([200,303].includes(respuesta.status));assert.equal((await db.query('SELECT lugar FROM public.incidentes_robos WHERE id=$1',[incidente])).rows[0].lugar,'No informado');pruebas++;
 const modelo=await leerModeloDatos(app);assert.equal(modelo.tablas.find(t=>t.nombre==='equipos').registros,String((await db.query('SELECT count(*) FROM public.equipos')).rows[0].count));assert.equal(modelo.relaciones.find(r=>r.origen==='directorio_sedes'&&r.destino==='sedes').unica,true);assert.equal(modelo.relaciones.find(r=>r.origen==='equipos'&&r.destino==='sedes').unica,false);assert.ok(!modelo.relaciones.some(r=>r.origen==='equipos'&&r.destino==='dependencias'));pruebas++;
 const documento=await readFile('../docs/modelo-entidad-relacion.md','utf8');
 const mer=modeloMermaid(modelo);
 assert.ok(documento.includes(mer));pruebas++;
 const paginaModelo=main(await(await pedir('/documentacion/modelo-datos',ca)).text());assert.ok(paginaModelo.includes('Modelo entidad relación'));assert.ok(paginaModelo.includes('Descargar diagrama SVG'));assert.ok(paginaModelo.includes('directorio_sedes'));pruebas++;
 console.log(`${pruebas} comprobaciones de experiencia: navegación y perfiles, acciones Ver/Editar, carga privada, búsqueda de equipos por sede, reporte mínimo y modelo real de tablas/relaciones.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.incidentes_robos_historial WHERE incidente_id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.incidentes_robos_equipos WHERE incidente_id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.incidentes_robos WHERE id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.equipos WHERE id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.directorio_historial WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_sedes WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_cargas WHERE sha256=ANY($1)',[hashes]);
 const correos=[admin,consulta,encargado];await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);await Promise.all([app.end(),db.end()]);
}
