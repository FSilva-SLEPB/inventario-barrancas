// Datos sintéticos; ejecutar únicamente contra la base temporal de CI.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID(),randomUUID()],cat=randomUUID(),equipos=[],hashes=[];
const correo=`dir-gestion-${sufijo}@slepb.gob.cl`,consulta=`dir-consulta-${sufijo}@slepb.gob.cl`;
const cookie=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:email},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}});
const guardar=(sede,nombre,version=0,actor=correo)=>app.query('SELECT public.guardar_director_acceso($1,$2::uuid,$3,$4,$5)',[actor,sede,nombre,version,'Actualización ficticia']);
const leer=async sede=>(await db.query('SELECT * FROM public.directorio_sedes WHERE sede_id=$1',[sede])).rows[0];
const cargar=(filas,sha)=>app.query('SELECT public.cargar_directorio_acceso($1,$2::jsonb,$3,$4) AS resultado',[correo,JSON.stringify(filas),sha,'directorio-ficticio.csv']);
let pruebas=0;await db.connect();await app.connect();
try{
 for(let i=0;i<3;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna) VALUES($1,$2,$3,$4,$5)',[sedes[i],i===2?'nivel_central':i===1?'establecimiento':'jardin_infantil','Sede directorio '+i+' '+sufijo,i===2?null:'DIR-'+i+'-'+sufijo,'Pudahuel']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[cat,'Categoría directorio '+sufijo]);
 for(const[mail,rol]of [[correo,'administrador_gestion'],[consulta,'consulta']])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,NULL::uuid)',['felipe.silva@slepb.gob.cl',mail,'Persona ficticia',rol]);
 await assert.rejects(guardar(sedes[0],'Persona',0,consulta),e=>e.code==='42501');await assert.rejects(guardar(sedes[2],'Persona'),e=>e.code==='P2202');pruebas+=2;
 await guardar(sedes[0],'Directora primera');assert.equal((await leer(sedes[0])).version,1);assert.equal((await leer(sedes[0])).cargo,'Directora del jardín infantil');pruebas++;
 await assert.rejects(guardar(sedes[0],'Cambio obsoleto',0),e=>e.code==='P2201');assert.equal((await leer(sedes[0])).nombre,'Directora primera');pruebas++;
 const gestion=await cookie(correo),soloConsulta=await cookie(consulta);
 assert.equal((await pedir('/mantenedores/directores',soloConsulta)).headers.get('location'),'/sin-permiso');pruebas++;
 const html=await(await pedir('/directorio/directoras?editar='+sedes[0],gestion)).text();assert.ok(html.includes('Directora primera'));
 const f=new FormData(),dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');
 for(const[input]of html.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(input)?.[1];if(input.includes('type="hidden"')&&n?.startsWith('$ACTION'))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(input)?.[1]??''));}
 assert.ok([...f.keys()].some(n=>n.startsWith('$ACTION')));
 for(const[k,v]of Object.entries({seccion:'directoras',filtros:'',sede:sedes[0],nombres:'Directora',apellidos:'actualizada',version:'1',motivo:'Cambio ficticio',sedeVersion:JSON.stringify(['Sede directorio 0 '+sufijo,'','Pudahuel','']),rut:'',situacion:'titular'}))f.set(k,v);
 const respuesta=await fetch(origen+'/directorio/directoras?editar='+sedes[0],{method:'POST',redirect:'manual',headers:{Origin:new URL(origen).origin,Cookie:gestion},body:f});assert.equal(respuesta.status,303);assert.equal((await leer(sedes[0])).nombre,'Directora actualizada');assert.equal((await leer(sedes[0])).version,2);pruebas++;
 const sha=createHash('sha256').update(randomUUID()).digest('hex');hashes.push(sha);
 const fallo=[{sedeId:sedes[0],nombre:'No debe guardarse',version:2},{sedeId:sedes[2],nombre:'No corresponde',version:0}];
 await assert.rejects(cargar(fallo,sha),e=>e.code==='P2202');assert.equal((await leer(sedes[0])).nombre,'Directora actualizada');assert.equal((await db.query('SELECT count(*) FROM public.directorio_cargas WHERE sha256=$1',[sha])).rows[0].count,'0');pruebas++;
 const datos=[{sedeId:sedes[0],nombre:'Directora desde CSV',version:2},{sedeId:sedes[1],nombre:'Director desde CSV',version:0}];
 assert.equal((await cargar(datos,sha)).rows[0].resultado.repetida,false);assert.equal((await cargar(datos,sha)).rows[0].resultado.repetida,true);assert.equal((await leer(sedes[0])).version,3);assert.equal((await leer(sedes[1])).cargo,'Director/a del establecimiento');pruebas++;
 await assert.rejects(app.query('UPDATE public.directorio_sedes SET nombre=$1',['Cambio directo']),e=>e.code==='42501');pruebas++;
 // Receptora automática editable, conservada al cambiar después el directorio.
 const id=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[correo,JSON.stringify({id:'',sedeId:sedes[0],categoriaId:cat,marca:'Marca ficticia',modelo:'Modelo ficticio',serie:'DIR-S-'+sufijo,inventario:'DIR-I-'+sufijo,motivoIdentificacion:'',origen:'compra_utic',condicionTecnica:'sin_verificar',compra:{},observaciones:''}),'Registro ficticio'])).rows[0].id;equipos.push(id);
 const seleccion=await(await pedir('/inventario/movimientos/regularizar?equipo='+id,gestion)).text();assert.ok(seleccion.includes('value="Directora desde CSV"'));pruebas++;
 const solicitud=randomUUID();await app.query('SELECT public.regularizar_entregas_acceso($1,$2::uuid,$3::jsonb)',[correo,solicitud,JSON.stringify([{sedeId:sedes[0],equipos:[{id,version:1}],receptora:'Directora desde CSV',fecha:'2026-10-26',enlaceActa:''}])]);
 await guardar(sedes[0],'Directora posterior',3);const entrega=(await db.query('SELECT receptor_nombre FROM public.entregas_equipos WHERE lote_id=$1',[solicitud])).rows[0];assert.equal(entrega.receptor_nombre,'Directora desde CSV');assert.equal((await leer(sedes[0])).nombre,'Directora posterior');pruebas++;
 const auditoria=await db.query('SELECT antes,despues,actor FROM public.directorio_historial WHERE sede_id=$1 ORDER BY registrado_en',[sedes[0]]);assert.equal(auditoria.rows.length,4);assert.equal(auditoria.rows.at(-1).antes.nombre,'Directora desde CSV');assert.equal(auditoria.rows.at(-1).despues.nombre,'Directora posterior');pruebas++;
 const ficha=await(await pedir('/inventario/'+id,gestion)).text();assert.ok(ficha.includes('Editar información'));assert.ok(!ficha.includes('id="formulario-equipo"'));assert.ok(ficha.includes('Adquisición')||ficha.includes('Identificación'));assert.ok(ficha.includes('linea-historial'));pruebas++;
 console.log(`${pruebas} comprobaciones de directorio: permisos, edición HTTP, versiones, carga atómica, duplicados, recepción automática e historial independiente.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.entregas_detalle WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.entregas_equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.entregas_lotes WHERE actor=$1',[correo]);
 await db.query('DELETE FROM public.equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_historial WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_sedes WHERE sede_id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.directorio_cargas WHERE sha256=ANY($1)',[hashes]);
 await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[[correo,consulta]]);await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[[correo,consulta]]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);await Promise.all([app.end(),db.end()]);
}
