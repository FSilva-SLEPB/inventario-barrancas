// Integración con PostgreSQL y acciones reales; solo datos sintéticos de CI.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const {encodeReply}=createRequire(import.meta.url)('next/dist/compiled/react-server-dom-webpack/client.node');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID()],cat=randomUUID(),equipos=[],hashes=[];
const admin=`dir-completo-${sufijo}@slepb.gob.cl`,consulta=`dir-lectura-${sufijo}@slepb.gob.cl`;
const cookie=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:email},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}});
const sede=async id=>(await db.query('SELECT * FROM public.sedes WHERE id=$1',[id])).rows[0];
const director=async id=>(await db.query('SELECT * FROM public.directorio_sedes WHERE sede_id=$1',[id])).rows[0];
const versionSede=s=>JSON.stringify([s.nombre,s.direccion??'',s.comuna??'',s.correo_institucional??'']);
const datos=s=>({nombre:'Responsable ficticia',rut:'12345678-5',correo:'responsable@example.org',situacion:'subrogante',observaciones:'01/09/2026',sedeNombre:s.nombre,direccion:'Calle de ejemplo 123',comuna:'Pudahuel',correoInstitucional:'establecimiento@example.org'});
const guardar=(actor,id,d,v,sv)=>app.query('SELECT public.guardar_ficha_directorio_acceso($1,$2::uuid,$3::jsonb,$4,$5,$6)',[actor,id,JSON.stringify(d),v,sv,'Actualización ficticia']);
const manifiesto=JSON.parse(await readFile('.next/server/server-reference-manifest.json','utf8'));
const idAccion=Object.entries(manifiesto.node).find(([,a])=>a.exportedName==='cargarDirectorio'&&a.filename?.includes('/mantenedores/directores/'))?.[0];assert.ok(idAccion);
// Usa la misma codificación multipart de React que la aplicación.
async function cargarHTTP(c,listado,operacion,previa){const f=new FormData();f.set('listado',listado);f.set('operacion',operacion);if(previa){f.set('hash',previa.hash);f.set('versiones',previa.versiones);f.set('confirmo','si');}const r=await fetch(origen+'/mantenedores/directores/cargar',{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:new URL(origen).origin,'Next-Action':idAccion},body:await encodeReply([{},f])}),texto=await r.text();for(const linea of texto.split('\n')){try{const obj=JSON.parse(linea.replace(/^[0-9a-f]+:/,''));if(obj&&typeof obj==='object'&&['previa','error','guardado'].includes(obj.estado))return obj;}catch{}}return {estado:'sin-estado',status:r.status};}
let pruebas=0;await db.connect();await app.connect();
try{
 for(let i=0;i<2;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna) VALUES($1,$2,$3,$4,$5)',[sedes[i],i?'establecimiento':'jardin_infantil','Establecimiento directorio completo '+i+' '+sufijo,'DC-'+i+'-'+sufijo,'Pudahuel']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[cat,'Categoría directorio completo '+sufijo]);
 for(const[email,rol]of [[admin,'administrador_gestion'],[consulta,'consulta']])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,NULL::uuid)',['felipe.silva@slepb.gob.cl',email,'Persona ficticia',rol]);
 let s=await sede(sedes[0]),d=datos(s);await assert.rejects(guardar(consulta,s.id,d,0,versionSede(s)),e=>e.code==='42501');pruebas++;
 await assert.rejects(guardar(admin,s.id,{...d,rut:'12345678-4'},0,versionSede(s)),e=>e.code==='22023');assert.equal((await sede(s.id)).direccion,null);pruebas++;
 await guardar(admin,s.id,d,0,versionSede(s));assert.equal((await director(s.id)).rut,'12345678-5');assert.equal((await sede(s.id)).direccion,d.direccion);pruebas++;
 // La versión de la sede también protege contra una edición simultánea fuera del directorio.
 const antigua=versionSede(await sede(s.id));await db.query('UPDATE public.sedes SET direccion=$2 WHERE id=$1',[s.id,'Dirección modificada por otro editor']);
 await assert.rejects(guardar(admin,s.id,d,1,antigua),e=>e.code==='P2201');assert.equal((await director(s.id)).version,1);pruebas++;
 const ca=await cookie(admin),cc=await cookie(consulta);assert.equal((await pedir('/mantenedores/directores?ver='+s.id,cc)).headers.get('location'),'/sin-permiso');pruebas++;
 const ficha=await(await pedir('/mantenedores/directores?ver='+s.id,ca)).text();assert.ok(ficha.includes('12345678-5'));assert.ok(ficha.includes('responsable@example.org'));assert.ok(ficha.includes('Subrogante'));pruebas++;
 const s2=await sede(sedes[1]);
 const cab='RBD\tESTABLECIMIENTO\tCOMUNA\tDIRECCIÓN\tCORREO ELECTRÓNICO ESTABLECIMIENTO\tRUT DIRECTOR/A\tDIRECTOR/A\tCORREOS PERSONALES\tTIPO DE CESE\tFECHA ACTUALIZACION Y OBSERVACIONES';
 const listado=cab+'\n'+[s.rbd,s.nombre,'Pudahuel','Dirección del listado','jardin@example.org','12345678-5','Directora del listado','directora@example.org','SUBDORGANCIA','01/09/2026'].join('\t')+'\n'+[s2.rbd,s2.nombre,'Pudahuel','Dirección pendiente','','','','','',''].join('\t')+'\n'+['ORG-EJEMPLO','Servicio Local de Educación Pública de ejemplo','Pudahuel','Oficina institucional','----','11111111-1','Persona de Nivel Central','','VIGENCIA NORMAL',''].join('\t');
 const hash=createHash('sha256').update(listado).digest('hex');hashes.push(hash);
 const denegado=await cargarHTTP(cc,listado,'previa');assert.notEqual(denegado.estado,'previa');pruebas++;
 const previa=await cargarHTTP(ca,listado,'previa');assert.equal(previa.estado,'previa',JSON.stringify(previa));assert.equal(previa.vista.length,2);assert.equal(previa.omitidas.length,1);assert.equal((await director(s.id)).nombre,'Responsable ficticia');pruebas++;
 const modificado=await cargarHTTP(ca,listado+'\n','confirmar',previa);assert.equal(modificado.estado,'error');assert.equal((await director(s.id)).nombre,'Responsable ficticia');pruebas++;
 const confirmado=await cargarHTTP(ca,listado,'confirmar',previa);assert.equal(confirmado.estado,'guardado',JSON.stringify(confirmado));assert.equal((await director(s.id)).nombre,'Directora del listado');assert.equal((await director(s2.id)).situacion,'pendiente');assert.equal((await director(s2.id)).nombre,null);pruebas++;
 const repetido=await cargarHTTP(ca,listado,'confirmar',previa);assert.equal(repetido.estado,'guardado');assert.equal((await director(s.id)).version,2);pruebas++;
 // Confirmación atómica: una fila válida seguida de RUN inválido no modifica la primera.
 s=await sede(s.id);const lote=[{...datos(s),sedeId:s.id,version:2,sedeVersion:versionSede(s)},{...datos(await sede(s2.id)),rut:'12345678-4',sedeId:s2.id,version:1,sedeVersion:versionSede(await sede(s2.id))}];
 const hashFallido=createHash('sha256').update(randomUUID()).digest('hex');hashes.push(hashFallido);
 await assert.rejects(app.query('SELECT public.cargar_directorio_acceso($1,$2::jsonb,$3,$4)',[admin,JSON.stringify(lote),hashFallido,'ficticio.csv']),e=>e.code==='22023');assert.equal((await director(s.id)).nombre,'Directora del listado');pruebas++;
 // La entrega guarda RUN, contacto y establecimiento; un cambio posterior no la reescribe.
 const equipo=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[admin,JSON.stringify({id:'',sedeId:s.id,categoriaId:cat,marca:'Marca ficticia',modelo:'Modelo ficticio',serie:'DC-S-'+sufijo,inventario:'DC-I-'+sufijo,motivoIdentificacion:'',origen:'compra_utic',condicionTecnica:'sin_verificar',compra:{},observaciones:''}),'Registro ficticio'])).rows[0].id;equipos.push(equipo);
 const automatica=await(await pedir('/inventario/movimientos/regularizar?equipo='+equipo,ca)).text();assert.ok(automatica.includes('value="12345678-5"'));assert.ok(automatica.includes('value="directora@example.org"'));pruebas++;
 const solicitud=randomUUID();await app.query('SELECT public.regularizar_entregas_acceso($1,$2::uuid,$3::jsonb)',[admin,solicitud,JSON.stringify([{sedeId:s.id,equipos:[{id:equipo,version:1}],fecha:'2026-10-26',receptora:'Directora del listado',receptoraRut:'12345678-5',receptoraCorreo:'directora@example.org',enlaceActa:'',sedeVersion:versionSede(s)}])]);
 const entrega=(await db.query('SELECT * FROM public.entregas_equipos WHERE lote_id=$1',[solicitud])).rows[0];
 await guardar(admin,s.id,{...datos(s),nombre:'',rut:'',correo:'',situacion:'vacante'},2,versionSede(s));assert.equal((await director(s.id)).nombre,null);assert.equal((await director(s.id)).situacion,'vacante');
 const historica=(await db.query('SELECT * FROM public.entregas_equipos WHERE id=$1',[entrega.id])).rows[0];assert.equal(historica.receptor_nombre,'Directora del listado');assert.equal(historica.receptor_datos.rut,'12345678-5');assert.equal(historica.receptor_datos.correo,'directora@example.org');assert.equal(historica.sede_datos.direccion,'Dirección del listado');pruebas++;
 const detalle=await(await pedir('/inventario/movimientos/entregas/'+entrega.id,ca)).text();assert.ok(detalle.includes('12345678-5')&&detalle.includes('Dirección del listado'));pruebas++;
 const audit=(await db.query('SELECT antes,despues FROM public.directorio_historial WHERE sede_id=$1 ORDER BY registrado_en,id',[s.id])).rows;assert.equal(audit.length,3);assert.equal(audit.at(-1).antes.nombre,'Directora del listado');assert.equal(audit.at(-1).despues.nombre,null);assert.equal(audit.at(-1).despues.situacion,'vacante');pruebas++;
 // Nueva persona tras la vacancia, y antigua función de solo nombre no hereda contactos.
 const actual=await sede(s.id);await guardar(admin,s.id,{...datos(actual),nombre:'Persona nueva',rut:'11111111-1',correo:'nueva@example.org',situacion:'titular'},3,versionSede(actual));await app.query('SELECT public.guardar_director_acceso($1,$2::uuid,$3,$4,$5)',[admin,s.id,'Otro reemplazo',4,'Cambio de persona ficticio']);assert.equal((await director(s.id)).rut,null);assert.equal((await director(s.id)).correo,null);pruebas++;
 console.log(`${pruebas} comprobaciones de directorio completo: carga HTTP del listado, contactos, RUN, subrogancias, pendientes, sede concurrente, atomicidad, vacancia y recepción histórica.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.entregas_detalle WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.entregas_equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.entregas_lotes WHERE actor=$1',[admin]);await db.query('DELETE FROM public.equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);
 await db.query('DELETE FROM public.directorio_historial WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_sedes WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_cargas WHERE sha256=ANY($1)',[hashes]);
 await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[[admin,consulta]]);await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[[admin,consulta]]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);await Promise.all([app.end(),db.end()]);
}
