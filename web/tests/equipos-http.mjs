// Integración real con identidades ficticias; no utiliza datos institucionales.
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.NEXTAUTH_SECRET&&process.env.TEST_ADMIN_DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL});
const app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID();const sedes=[randomUUID(),randomUUID(),randomUUID()];const cat=randomUUID();
const correos=Object.fromEntries(['encargado','consulta','gestion','general'].map(k=>[k,`equipo-${k}-${sufijo}@slepb.gob.cl`]));
const equipos=[];const hashes=[];let pruebas=0;
const cookies=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:email,rol:'administrador',sedeId:sedes[1]},maxAge:600});
const pedir=(ruta,cookie)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:cookie}});
const datos=(cambios={})=>({id:'',sedeId:sedes[0],categoriaId:cat,marca:'Marca ficticia',modelo:'Modelo '+sufijo,
  serie:'S-'+randomUUID(),inventario:'I-'+randomUUID(),motivoIdentificacion:'',origen:'compra_sede',condicionTecnica:'sin_verificar',compra:{},observaciones:'',...cambios});
const guardar=async(actor,d,version=0,motivo='Registro ficticio')=>{
 const {rows}=await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,$3,$4) AS id',[actor,JSON.stringify(d),version,motivo]);equipos.push(rows[0].id);return rows[0].id;
};
async function falla(actor,d,codigo,version=0,motivo='Prueba denegada') {
 await assert.rejects(guardar(actor,d,version,motivo),e=>e.code===codigo);pruebas++;
}
function camposAccion(html){
 const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');const campos=[];
 for(const [input]of html.matchAll(/<input\b[^>]*>/g)){
  const nombre=/\bname="([^"]+)"/.exec(input)?.[1];
  if(input.includes('type="hidden"')&&nombre?.startsWith('$ACTION'))campos.push([dec(nombre),dec(/\bvalue="([^"]*)"/.exec(input)?.[1]??'')]);
 }assert.ok(campos.length);return campos;
}
function formularioEquipo(html){
 const bloque=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(m=>m.includes('formulario-equipo'));assert.ok(bloque);
 const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');const f=new FormData();
 for(const [input] of bloque.matchAll(/<input\b[^>]*>/g)){const nombre=/\bname="([^"]+)"/.exec(input)?.[1];if(nombre&&!/type="(?:file|checkbox|radio)"/.test(input))f.append(dec(nombre),dec(/\bvalue="([^"]*)"/.exec(input)?.[1]??''));}
 for(const [,nombre,contenido] of bloque.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const opciones=[...contenido.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)],e=opciones.find(e=>/\bselected\b/.test(e[1]))??opciones[0];if(e)f.append(dec(nombre),dec(/\bvalue="([^"]*)"/.exec(e[1])?.[1]??e[2]));}
 for(const [,nombre,contenido] of bloque.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))f.append(dec(nombre),dec(contenido));return f;
}
await db.connect();await app.connect();
try {
 await db.query(`INSERT INTO public.sedes(id,tipo,nombre,rbd) VALUES ($1,'establecimiento',$4,$7),($2,'jardin_infantil',$5,$8),($3,'nivel_central',$6,NULL)`,
  [...sedes,'Escuela ficticia '+sufijo,'Jardin ficticio '+sufijo,'Central ficticia '+sufijo,'RBD-A-'+sufijo,'RBD-B-'+sufijo]);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES ($1,$2)',[cat,'Categoria ficticia '+sufijo]);
 for(const [k,rol]of Object.entries({encargado:'encargado',consulta:'consulta_sede',gestion:'administrador_gestion',general:'consulta'}))
  await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',correos[k],'Persona ficticia',rol,['encargado','consulta'].includes(k)?sedes[0]:null]);
 const recibido=datos();const id=await guardar(correos.encargado,recibido);pruebas++;
 const pendiente=await guardar(correos.gestion,datos({origen:'compra_utic'}));
 const ajeno=await guardar(correos.gestion,datos({sedeId:sedes[1]}));
 const central=await guardar(correos.gestion,datos({sedeId:sedes[2],origen:'compra_utic'}));
 const leer=async id=>(await db.query('SELECT * FROM public.equipos WHERE id=$1',[id])).rows[0];
 assert.equal((await leer(id)).situacion,'recibido');assert.equal((await leer(pendiente)).situacion,'pendiente_entrega');
 assert.equal((await leer(central)).situacion,'registrado_nc');pruebas+=3;
 const anteriorPendiente=await leer(pendiente);
 await guardar(correos.gestion,datos({id:pendiente,serie:anteriorPendiente.serie,inventario:anteriorPendiente.numero_inventario,origen:'donacion',situacion:'recibido',estadoHistorico:'Activo'}),1,'Corrección sin cambiar entrega');
 assert.equal((await leer(pendiente)).situacion,'pendiente_entrega');assert.equal((await leer(pendiente)).origen,'compra_utic');pruebas++;
 await falla(correos.consulta,datos(),'42501');await falla(correos.general,datos(),'42501');
 await falla(correos.encargado,datos({sedeId:sedes[1]}),'42501');
 await falla(correos.encargado,datos({origen:'compra_utic'}),'42501');
 await falla(correos.encargado,{...recibido,id:pendiente},'42501',1);
 await falla(correos.encargado,{...recibido,id:ajeno},'42501',1);
 await falla(correos.gestion,{...recibido,id,sedeId:sedes[1]},'P2003',1);
 await falla(correos.gestion,datos({serie:recibido.serie.toLowerCase()}),'23505');
 await falla(correos.gestion,datos({inventario:recibido.inventario.toLowerCase()}),'23505');
 await falla(correos.encargado,datos({serie:'',inventario:''}),'22023');
 const sinid=await guardar(correos.encargado,datos({serie:'',inventario:'',motivoIdentificacion:'Equipo antiguo sin etiquetas',observaciones:'Equipo antiguo sin etiquetas'}));
 assert.equal((await leer(sinid)).serie,null);pruebas++;
 const corregido={...recibido,id,serie:'CORREGIDA-'+sufijo,estadoHistorico:'Activo',situacion:'recibido',sede_id:sedes[1]};
 await guardar(correos.encargado,corregido,1,'Corrección documentada');
 assert.equal((await leer(id)).version,2);
 const historia=(await db.query('SELECT antes,despues,actor,motivo FROM public.equipos_historial WHERE equipo_id=$1 ORDER BY id DESC LIMIT 1',[id])).rows[0];
 assert.equal(historia.antes.serie,recibido.serie);assert.equal(historia.despues.serie,corregido.serie);
 assert.equal(historia.actor,correos.encargado);assert.equal(historia.motivo,'Corrección documentada');pruebas++;
 await falla(correos.encargado,corregido,'P2002',1);
 await falla(correos.encargado,corregido,'22023',2,'');
 await assert.rejects(app.query('DELETE FROM public.equipos WHERE id=$1',[id]),e=>e.code==='42501');
 await assert.rejects(app.query('UPDATE public.equipos SET serie=$1 WHERE id=$2',['eludir',id]),e=>e.code==='42501');
 await assert.rejects(app.query('DELETE FROM public.equipos_historial WHERE equipo_id=$1',[id]),e=>e.code==='42501');pruebas+=3;
 const enc=await cookies(correos.encargado),consulta=await cookies(correos.consulta),gestion=await cookies(correos.gestion);
 const lista=await(await pedir('/inventario/p02?ambito=nc',enc)).text();
 assert.ok(lista.includes('Inventario de mi sede'));assert.ok(lista.includes('Escuela ficticia '+sufijo));
 assert.ok(!lista.includes('Jardin ficticio '+sufijo));assert.ok(!lista.includes('Central ficticia '+sufijo));pruebas++;
 const forzada=await(await pedir('/inventario/p02?sede='+sedes[1],enc)).text();assert.ok(!forzada.includes('ver='+ajeno));pruebas++;
 assert.equal((await pedir('/inventario/'+ajeno,enc)).status,404);assert.equal((await pedir('/inventario/'+central,enc)).status,404);pruebas+=2;
 const ficha=await(await pedir('/inventario/'+id,enc)).text();assert.ok(ficha.includes('Corrección documentada'));assert.ok(ficha.includes(recibido.serie));
 assert.ok(ficha.includes('Editar información'));assert.ok(!ficha.includes('id="formulario-equipo"'));pruebas++;
 const fichaEditar=await(await pedir('/inventario/'+id+'?editar=si',enc)).text();assert.ok(fichaEditar.includes('id="formulario-equipo"'));pruebas++;
 const pendienteHtml=await(await pedir('/inventario/'+pendiente,enc)).text();assert.ok(!pendienteHtml.includes('id="formulario-equipo"'));pruebas++;
 const soloLectura=await(await pedir('/inventario/'+id,consulta)).text();assert.ok(!soloLectura.includes('id="formulario-equipo"'));pruebas++;
 const accion=camposAccion(fichaEditar);const f=new FormData();for(const[k,v]of accion)f.append(k,v);
 const denegado=await fetch(origen+'/inventario/'+id,{method:'POST',redirect:'manual',headers:{Origin:new URL(origen).origin,Cookie:consulta},body:f});
 assert.equal(new URL(denegado.headers.get('location'),origen).pathname,'/sin-permiso');pruebas++;
 const recibidos=await(await pedir('/inventario/p02',enc)).text();assert.ok(!recibidos.includes('ver='+pendiente));
 const pendientes=await(await pedir('/inventario/p02?vista=pendientes',enc)).text();assert.ok(pendientes.includes('ver='+pendiente));assert.ok(!pendientes.includes('ver='+id));pruebas++;
 const nc=await(await pedir('/inventario/nivel-central',gestion)).text();assert.ok(nc.includes('ver='+central));assert.ok(!nc.includes('ver='+id));pruebas++;
 assert.equal((await pedir('/inventario/nivel-central',enc)).headers.get('location'),'/sin-permiso');pruebas++;
 const entrada=await(await pedir('/inventario',gestion)).text();assert.ok(entrada.includes('href="/inventario/nivel-central"'));assert.ok(entrada.includes('href="/inventario/p02"'));pruebas++;
 const jardines=await(await pedir('/inventario/p02?tipo=jardin_infantil',gestion)).text();assert.ok(jardines.includes('ver='+ajeno));assert.ok(!jardines.includes('ver='+id));pruebas++;
 // Los filtros de nombre (ID), RBD y tipo se combinan y conservan el alcance.
 const rbdEscuela='RBD-A-'+sufijo;
 const porRbd=await(await pedir('/inventario/p02?tipo=establecimiento&rbd='+encodeURIComponent(rbdEscuela),gestion)).text();
 assert.ok(porRbd.includes('ver='+id));assert.ok(!porRbd.includes('ver='+ajeno));pruebas++;
 const porNombre=await(await pedir('/inventario/p02?tipo=jardin_infantil&sede='+sedes[1],gestion)).text();
 assert.ok(porNombre.includes('ver='+ajeno));assert.ok(!porNombre.includes('ver='+id));pruebas++;
 const cruzados=await(await pedir('/inventario/p02?tipo=jardin_infantil&rbd='+encodeURIComponent(rbdEscuela),gestion)).text();
 assert.ok(!cruzados.includes('ver='+id));assert.ok(!cruzados.includes('ver='+ajeno));
 assert.ok(cruzados.includes('No hay equipos que coincidan'));pruebas++;
 const ataqueRbd=await(await pedir('/inventario/p02?ambito=nc&tipo=jardin_infantil&rbd='+encodeURIComponent('RBD-B-'+sufijo)+'&sede='+sedes[1],enc)).text();
 assert.ok(ataqueRbd.includes('ver='+id));assert.ok(!ataqueRbd.includes('ver='+ajeno));assert.ok(!ataqueRbd.includes('ver='+central));pruebas++;
 assert.equal((await pedir('/inventario/carga',enc)).headers.get('location'),'/sin-permiso');
 assert.equal((await pedir('/inventario/carga',consulta)).headers.get('location'),'/sin-permiso');pruebas+=2;
 // La carga es atómica e idempotente; los faltantes no inventan fecha ni acta.
 const importar=async(filas,hash)=>app.query('SELECT public.cargar_equipos_acceso($1,$2::jsonb,$3,$4) AS resultado',[correos.gestion,JSON.stringify(filas),'ficticio.csv',hash]);
 const lote=[datos({estadoHistorico:'Activo',fechaEntrega:'',enlaceActa:'',filaOrigen:2}),datos({origen:'compra_utic',estadoHistorico:'En Bodega del SLEP',fechaEntrega:'',enlaceActa:'',filaOrigen:3})];
 const hash=createHash('sha256').update(randomUUID()).digest('hex');hashes.push(hash);
 const carga=(await importar(lote,hash)).rows[0].resultado;
 assert.equal(carga.cantidad,2);assert.equal((await importar(lote,hash)).rows[0].resultado.repetida,true);
 const cargados=(await db.query('SELECT * FROM public.equipos WHERE carga_id=$1 ORDER BY fila_origen',[carga.id])).rows;
 equipos.push(...cargados.map(e=>e.id));assert.equal(cargados.length,2);assert.equal(cargados[0].situacion,'recibido_historico');assert.equal(cargados[0].fecha_entrega,null);assert.equal(cargados[0].enlace_acta,null);assert.equal(cargados[1].situacion,'pendiente_entrega');pruebas+=2;
 const fichaCargada=await(await pedir('/inventario/'+cargados[0].id,enc)).text();
 assert.ok(fichaCargada.includes('ficticio.csv'));assert.ok(fichaCargada.includes('Editar información'));assert.ok(!fichaCargada.includes('id="formulario-equipo"'));pruebas++;
 const fallido=createHash('sha256').update(randomUUID()).digest('hex');hashes.push(fallido);
 await assert.rejects(importar([datos({estadoHistorico:'Activo',filaOrigen:2}),datos({serie:corregido.serie,estadoHistorico:'Activo',filaOrigen:3})],fallido),e=>e.code==='23505');
 assert.equal(Number((await db.query('SELECT count(*) FROM public.cargas_equipos WHERE sha256=$1',[fallido])).rows[0].count),0);pruebas++;
 // Dos peticiones concurrentes con la misma serie solo pueden crear un equipo.
 const concurrencia=datos();const clientes=[new pg.Client({connectionString:process.env.DATABASE_URL}),new pg.Client({connectionString:process.env.DATABASE_URL})];
 try{
  await Promise.all(clientes.map(c=>c.connect()));
  const resultados=await Promise.allSettled(clientes.map(c=>c.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[correos.gestion,JSON.stringify(concurrencia),'Prueba concurrente'])));
  assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);assert.equal(resultados.filter(r=>r.status==='rejected'&&r.reason.code==='23505').length,1);
  equipos.push(...resultados.filter(r=>r.status==='fulfilled').map(r=>r.value.rows[0].id));pruebas++;
 }finally{await Promise.all(clientes.map(c=>c.end()));}
 // Paginación real: los tres tamaños usan el límite SQL y conservan la búsqueda.
 const lotePaginacion=Array.from({length:151},()=>datos({modelo:'PAGINACION-'+sufijo}));
 await app.query("SELECT public.guardar_equipo_acceso($1,value,0,'Prueba de paginación') FROM jsonb_array_elements($2::jsonb)",[correos.gestion,JSON.stringify(lotePaginacion)]);
 for(const limite of [50,100,150]){
  const html=await(await pedir('/inventario/p02?tipo=establecimiento&limite='+limite+'&q=PAGINACION-'+sufijo,gestion)).text();
  const cuerpo=/<tbody>([\s\S]*?)<\/tbody>/.exec(html)?.[1]??'';
  assert.equal((cuerpo.match(/<tr\b/g)??[]).length,limite);pruebas++;
  const segunda=await(await pedir('/inventario/p02?tipo=establecimiento&limite='+limite+'&pagina=2&q=PAGINACION-'+sufijo,gestion)).text();
  const filas=/<tbody>([\s\S]*?)<\/tbody>/.exec(segunda)?.[1]??'';
  assert.equal((filas.match(/<tr\b/g)??[]).length,Math.min(limite,151-limite));pruebas++;
 }
 const bodega=await(await pedir('/inventario/bodega-ti?vista=inventario',gestion)).text();
 assert.ok(bodega.includes('ver='+pendiente));assert.ok(!bodega.includes('ver='+id));pruebas++;
 for(const sesion of [enc,consulta,await cookies(correos.general)]){
  assert.equal((await pedir('/inventario/bodega-ti',sesion)).headers.get('location'),'/sin-permiso');pruebas++;
 }
 // Ficha y edición sobre el listado: filtros, ámbitos, datos, errores y cierre.
 const volver='/inventario/p02?'+new URLSearchParams({vista:'inventario',q:sufijo,pagina:'1',tipo:'establecimiento',sede:sedes[0],rbd:rbdEscuela,limite:'100'});
 const urlFicha=volver+'&ver='+id,urlEditar=volver+'&editar='+id;
 const lectura=await(await pedir(urlFicha,enc)).text();assert.ok(lectura.includes('<dialog'));assert.ok(lectura.includes('Corrección documentada'));assert.ok(!lectura.includes('id="formulario-equipo"'));assert.ok(lectura.includes('Editar información'));pruebas++;
 for(const [ruta,equipo,sesion]of [['/inventario/p02',central,gestion],['/inventario/nivel-central',id,gestion],['/inventario/bodega-ti',id,gestion],['/inventario/p02',ajeno,enc],['/inventario/p02',pendiente,gestion]]){const r=await pedir(ruta+'?ver='+equipo,sesion);assert.equal(r.status,404);pruebas++;}
 const soloLecturaModal=await(await pedir(volver+'&editar='+id,consulta)).text();assert.ok(!soloLecturaModal.includes('id="formulario-equipo"'));assert.ok(!soloLecturaModal.includes('aria-label="Editar información del equipo"'));pruebas++;
 const pendienteModal=await(await pedir('/inventario/p02?vista=pendientes&editar='+pendiente,enc)).text();assert.ok(!pendienteModal.includes('id="formulario-equipo"'));pruebas++;
 const editarHtml=await(await pedir(urlEditar,gestion)).text(),formularioModal=formularioEquipo(editarHtml);assert.equal(formularioModal.get('modelo'),(await leer(id)).modelo);assert.equal(formularioModal.get('volver'),volver);pruebas++;
 const enviarModal=f=>fetch(origen+urlEditar,{method:'POST',redirect:'manual',headers:{Origin:new URL(origen).origin,Cookie:gestion},body:f});
 const versionModal=(await leer(id)).version;formularioModal.set('volver','https://ajeno.invalid');formularioModal.set('motivoCambio','Edición modal ficticia');const retornoMalo=await enviarModal(formularioModal);assert.equal(retornoMalo.status,200);assert.equal((await leer(id)).version,versionModal);pruebas++;
 formularioModal.set('volver',volver);formularioModal.set('modelo','');const invalidoModal=await enviarModal(formularioModal);assert.equal(invalidoModal.status,200);assert.ok((await invalidoModal.text()).includes('Este dato es obligatorio.'));assert.equal((await leer(id)).version,versionModal);pruebas++;
 formularioModal.set('modelo','Modelo desde ventana '+sufijo);const actualizadoModal=await enviarModal(formularioModal);assert.equal(actualizadoModal.status,303);const destinoModal=new URL(actualizadoModal.headers.get('location'),origen);assert.equal(destinoModal.pathname,'/inventario/p02');assert.ok(destinoModal.searchParams.get('aviso'));for(const [k,v]of new URL(volver,origen).searchParams)assert.equal(destinoModal.searchParams.get(k),v);assert.ok(!destinoModal.searchParams.has('editar'));assert.ok(!destinoModal.searchParams.has('ver'));const cerradoModal=await(await pedir(destinoModal.pathname+destinoModal.search,gestion)).text();assert.ok(!cerradoModal.includes('<dialog'));assert.equal((await leer(id)).version,versionModal+1);pruebas++;
 // Doble envío con versión antigua: no duplica el historial ni confirma éxito.
 const nAntes=(await db.query('SELECT count(*) AS n FROM public.equipos_historial WHERE equipo_id=$1',[id])).rows[0].n;const repetidoModal=await enviarModal(formularioModal);assert.equal(repetidoModal.status,200);assert.ok((await repetidoModal.text()).includes('El equipo cambió.'));assert.equal((await db.query('SELECT count(*) AS n FROM public.equipos_historial WHERE equipo_id=$1',[id])).rows[0].n,nAntes);pruebas++;
 const registro=await(await pedir('/inventario/registro',gestion)).text();
 assert.ok(registro.includes('id="inventario-destino"'));assert.ok((await(await pedir('/inventario/registro?carga=1',gestion)).text()).includes('id="carga-masiva"'));pruebas++;
 assert.equal((await pedir('/inventario/registro',consulta)).headers.get('location'),'/sin-permiso');pruebas++;
 assert.equal((await pedir('/inventario/carga',gestion)).headers.get('location'),'/inventario/registro?carga=1#carga-masiva');pruebas++;
 console.log(`${pruebas} comprobaciones de equipos: aislamiento NC/EE/JI, historial, pendientes, solo lectura, duplicados, concurrencia, carga atómica, ventanas, filtros y cierre del guardado.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id IN(SELECT id FROM public.equipos WHERE sede_id=ANY($1::uuid[]))',[sedes]);
 await db.query('DELETE FROM public.equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);
 await db.query('DELETE FROM public.cargas_equipos WHERE sha256=ANY($1)',[hashes]);
 await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[Object.values(correos)]);
 await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[Object.values(correos)]);
 await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);
 await Promise.all([app.end(),db.end()]);
}
