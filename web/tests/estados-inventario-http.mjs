// Solo base temporal, sesiones ficticias y PDFs locales. No envía correos.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';

const {encode}=createRequire(import.meta.url)('next-auth/jwt'),origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID()],categoria=randomUUID(),creados=[];
const usuarios=Object.fromEntries(['administrador','administrador_gestion','consulta','encargado','consulta_sede'].map(r=>[r,'estados-'+r+'-'+sufijo+'@slepb.gob.cl']));
const condiciones=['operativo','bodega_ti','mantencion','mal_estado','obsoleto'];
const cookie=async correo=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:correo},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:c?{Cookie:c}:{}});
const post=(ruta,f,c)=>fetch(origen+ruta,{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:new URL(origen).origin},body:f});
const leer=async(clase,id)=>(await db.query('SELECT * FROM public.'+(clase==='equipo'?'equipos':'celulares')+' WHERE id=$1',[id])).rows[0];
const cambiar=(actor,solicitud,datos,cliente=app)=>cliente.query('SELECT public.guardar_estados_activo_acceso($1,$2::uuid,$3::jsonb) AS r',[actor,solicitud,JSON.stringify(datos)]);
const guardar=async(clase,id,administrativo,condicion,actor=usuarios.administrador_gestion)=>{
 const datos={clase,id,version:(await leer(clase,id)).version,administrativo,condicion},solicitud=randomUUID();
 return {solicitud,datos,resultado:(await cambiar(actor,solicitud,datos)).rows[0].r};
};
const fecha=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Santiago'});
const movimiento=async(clase,id,accion)=>({tipo:clase,bienId:id,accion,version:(await leer(clase,id)).version,destino:accion==='asignacion'?sedes[1]:'',fecha,receptor:'Persona ficticia',motivo:''});
const mover=(datos,solicitud=randomUUID())=>app.query('SELECT public.mover_bien_acceso($1,$2::uuid,$3::jsonb)',[usuarios.administrador_gestion,solicitud,JSON.stringify(datos)]);
const prestamo=async(clase,id)=>({...await movimiento(clase,id,'prestamo'),destino:sedes[1],fechaLimite:fecha,prestamoId:''});
const prestar=datos=>app.query('SELECT public.mover_prestamo_acceso($1,$2::uuid,$3::jsonb)',[usuarios.administrador_gestion,randomUUID(),JSON.stringify(datos)]);
const ficha=(clase,id)=>clase==='equipo'?'/inventario/'+id:'/inventario/celulares?estado=&ver='+id;
const codigo=esperado=>e=>e.code===esperado;
async function contenidoFicha(clase,id,c){const r=await pedir(ficha(clase,id),c);assert.equal(r.status,200);const html=await r.text();if(clase==='equipo')return html;const dialogo=/<dialog\b[^>]*>[\s\S]*?<\/dialog>/.exec(html)?.[0];assert.ok(dialogo,'Registro del celular abierto en ventana');return dialogo;}
const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
function formulario(html){
 const bloque=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(s=>s.includes('class="formulario-movimiento-inventario"'));
 assert.ok(bloque,'El movimiento se abre desde Bodega TI');
 const f=new FormData();
 for(const[t]of bloque.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(t)?.[1];if(n)f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(t)?.[1]??''));}
 for(const[,n,t]of bloque.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))f.append(n,dec(t));
 for(const[,n]of bloque.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>/g))f.append(n,'');
 return f;
}
async function crear(clase,custodia='en_bodega',condicion='sin_verificar'){
 let id;
 if(clase==='equipo')id=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[usuarios.administrador_gestion,JSON.stringify({id:'',sedeId:sedes[0],categoriaId:categoria,marca:'Marca ficticia',modelo:'Estados '+sufijo,serie:'EST-S-'+randomUUID(),inventario:'EST-I-'+randomUUID(),origen:'compra_utic',condicionTecnica:condicion,custodiaInicial:custodia}),'Alta ficticia'])).rows[0].id;
 else{
  id=randomUUID();
  const telefono='+569'+String(10000000+(parseInt(randomUUID().slice(0,8),16)%80000000));
  await app.query('SELECT public.guardar_celular_acceso($1,$2,$3::jsonb,0,$4)',[usuarios.administrador_gestion,id,JSON.stringify({sedeId:sedes[0],telefono,marca:'Marca ficticia',modelo:'Estados '+sufijo,imei:'',inventario:'EST-C-'+randomUUID(),condicionTecnica:condicion,responsable:'Persona ficticia',observaciones:'Antecedente original',activo:true,custodiaInicial:custodia}),'Alta ficticia']);
 }
 creados.push({clase,id});return id;
}
let pruebas=0;
async function caso(nombre,comprobar){try{await comprobar();pruebas++;}catch(e){throw new Error(nombre,{cause:e});}}
await db.connect();await app.connect();
try{
 for(const[i,id]of sedes.entries())await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,direccion,comuna) VALUES($1,$2,$3,$4,$5,$6)',[id,i?'jardin_infantil':'establecimiento','Sede estados '+i+' '+sufijo,'EST-'+i+'-'+sufijo,'Dirección ficticia','Comuna ficticia']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[categoria,'Categoría estados '+sufijo]);
 for(const[rol,correo]of Object.entries(usuarios))await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',correo,'Persona ficticia',rol,['encargado','consulta_sede'].includes(rol)?sedes[0]:null]);
 const ca=await cookie(usuarios.administrador_gestion),cs=await cookie(usuarios.administrador),cc=await cookie(usuarios.consulta);
 for(const clase of ['equipo','celular']){
  const id=await crear(clase),inicial=await leer(clase,id);
  await caso(clase+': conserva datos anteriores sin clasificación',async()=>{assert.equal(inicial.estado_administrativo,'activo');assert.equal(inicial.condicion_tecnica,'sin_verificar');assert.equal(inicial.fecha_baja,null);});
  await caso(clase+': guardar vacío conserva la condición anterior',async()=>{await assert.rejects(guardar(clase,id,'activo',''),codigo('22023'));assert.deepEqual(await leer(clase,id),inicial);});
  await caso(clase+': solo UTIC cambia estados',async()=>{
   const datos={clase,id,version:inicial.version,administrativo:'activo',condicion:'operativo'};
   for(const rol of ['consulta','encargado','consulta_sede'])await assert.rejects(cambiar(usuarios[rol],randomUUID(),datos),codigo('42501'));
   assert.deepEqual(await leer(clase,id),inicial);
  });
  await caso(clase+': la consulta HTTP no ofrece controles de escritura',async()=>{const html=await contenidoFicha(clase,id,cc);assert.ok(!/<select\b[^>]*name="estadoAdministrativo"/.test(html));assert.ok(!/<select\b[^>]*name="estadoCondicion"/.test(html));});
  await caso(clase+': rechaza estados y datos inválidos sin cambios',async()=>{
   const datos={clase,id,version:inicial.version,administrativo:'activo',condicion:'operativo'};
   for(const c of [{administrativo:'inactivo'},{administrativo:'__proto__'},{condicion:'sin_verificar'},{version:0},{version:1.5},{version:2147483647},{clase:'otro'},{id:'no-es-un-id'},{extra:'indebido'}])await assert.rejects(cambiar(usuarios.administrador_gestion,randomUUID(),{...datos,...c}),codigo('22023'));
   assert.deepEqual(await leer(clase,id),inicial);
  });
  await caso(clase+': Activo admite las cinco condiciones sin baja automática',async()=>{
   for(const condicion of condiciones){const antes=await leer(clase,id),r=await guardar(clase,id,'activo',condicion,condicion==='operativo'?usuarios.administrador:usuarios.administrador_gestion),actual=await leer(clase,id);assert.equal(actual.condicion_tecnica,condicion);assert.equal(actual.estado_administrativo,'activo');assert.equal(actual.fecha_baja,null);assert.equal(actual.version,antes.version+1);assert.equal(r.resultado.version,actual.version);}
  });
  await caso(clase+': idempotencia y UUID reutilizado',async()=>{
   const r=await guardar(clase,id,'activo','operativo'),antes=await leer(clase,id),tabla=clase==='equipo'?'equipos_historial':'celulares_historial',llave=clase==='equipo'?'equipo_id':'celular_id',n=(await db.query('SELECT count(*) FROM public.'+tabla+' WHERE '+llave+'=$1',[id])).rows[0].count;
   assert.equal((await cambiar(usuarios.administrador_gestion,r.solicitud,r.datos)).rows[0].r.repetida,true);
   assert.deepEqual(await leer(clase,id),antes);assert.equal((await db.query('SELECT count(*) FROM public.'+tabla+' WHERE '+llave+'=$1',[id])).rows[0].count,n);
   await assert.rejects(cambiar(usuarios.administrador_gestion,r.solicitud,{...r.datos,condicion:'mantencion'}),codigo('P3001'));
   await assert.rejects(cambiar(usuarios.administrador,r.solicitud,r.datos),codigo('P3001'));
  });
  await caso(clase+': versión obsoleta no sobrescribe el registro',async()=>{
   const antes=await leer(clase,id);await assert.rejects(cambiar(usuarios.administrador_gestion,randomUUID(),{clase,id,version:antes.version-1,administrativo:'robado',condicion:''}),codigo('P3001'));assert.deepEqual(await leer(clase,id),antes);
  });
  for(const administrativo of ['robado','no_encontrado'])await caso(clase+': '+administrativo+' vacía condición y bloquea movimientos',async()=>{
   await guardar(clase,id,administrativo,'operativo');const actual=await leer(clase,id);assert.equal(actual.estado_administrativo,administrativo);assert.equal(actual.condicion_tecnica,'');assert.equal(actual.fecha_baja,null);
   const html=await contenidoFicha(clase,id,ca),selector=/<select\b[^>]*name="estadoCondicion"[^>]*>[\s\S]*?<\/select>/.exec(html)?.[0];assert.ok(selector,'Selector de condición presente en ficha real');assert.match(selector,/\bdisabled=""/);assert.match(selector,/<option value="" selected=""><\/option>/);
   const antes=await leer(clase,id);await assert.rejects(mover(await movimiento(clase,id,'asignacion')),codigo('P3003'));await assert.rejects(prestar(await prestamo(clase,id)),codigo('P3003'));assert.deepEqual(await leer(clase,id),antes);
  });
  await caso(clase+': volver a Activo habilita selectores sin inventar condición',async()=>{
   await guardar(clase,id,'activo','');assert.equal((await leer(clase,id)).condicion_tecnica,'');
   const html=await contenidoFicha(clase,id,ca);for(const nombre of ['estadoAdministrativo','estadoCondicion']){const s=new RegExp('<select\\b[^>]*name="'+nombre+'"[^>]*>').exec(html)?.[0];assert.ok(s);assert.ok(!s.includes('disabled'));}
   await assert.rejects(mover(await movimiento(clase,id,'asignacion')),codigo('P3003'));
   await guardar(clase,id,'activo','operativo');assert.equal((await leer(clase,id)).condicion_tecnica,'operativo');
  });
  await caso(clase+': condiciones de reparación o descarte impiden salidas',async()=>{
   for(const condicion of ['mantencion','mal_estado','obsoleto']){await guardar(clase,id,'activo',condicion);const antes=await leer(clase,id);await assert.rejects(mover(await movimiento(clase,id,'asignacion')),codigo('P3003'));await assert.rejects(prestar(await prestamo(clase,id)),codigo('P3003'));assert.deepEqual(await leer(clase,id),antes);}
  });
  await caso(clase+': permite devolver un equipo averiado a Bodega TI',async()=>{
   const averiado=await crear(clase,'asignado');await guardar(clase,averiado,'activo','mantencion');await mover(await movimiento(clase,averiado,'devolucion'));assert.equal((await leer(clase,averiado)).custodia,'en_bodega');assert.equal((await leer(clase,averiado)).condicion_tecnica,'mantencion');
  });
  await caso(clase+': no se cambia el estado durante préstamo abierto',async()=>{
   const prestado=await crear(clase);await guardar(clase,prestado,'activo','operativo');await prestar(await prestamo(clase,prestado));const antes=await leer(clase,prestado);await assert.rejects(guardar(clase,prestado,'dado_de_baja','obsoleto'),codigo('P2802'));assert.deepEqual(await leer(clase,prestado),antes);
  });
  await caso(clase+': concurrencia conserva un solo cambio de la misma versión',async()=>{
   const carrera=await crear(clase),version=(await leer(clase,carrera)).version,app2=new pg.Client({connectionString:process.env.DATABASE_URL});await app2.connect();
   try{const resultados=await Promise.allSettled([cambiar(usuarios.administrador,randomUUID(),{clase,id:carrera,version,administrativo:'activo',condicion:'operativo'}),cambiar(usuarios.administrador_gestion,randomUUID(),{clase,id:carrera,version,administrativo:'activo',condicion:'mantencion'},app2)]);assert.equal(resultados.filter(r=>r.status==='fulfilled').length,1);assert.equal(resultados.filter(r=>r.status==='rejected'&&r.reason.code==='P3001').length,1);assert.equal((await leer(clase,carrera)).version,version+1);}finally{await app2.end();}
  });
  await caso(clase+': acta HTTP conserva estados, participantes y PDF tras la baja',async()=>{
   const documentado=await crear(clase);await guardar(clase,documentado,'activo','operativo');
   const ruta='/inventario/bodega-ti?movimiento=asignacion&claseBien='+clase+'&bien='+documentado,f=formulario(await(await pedir(ruta,ca)).text());
   for(const[k,v]of Object.entries({destino:sedes[1],fecha,receptor:'Persona receptora original',funcionario:'',motivo:'',entregaNombre:'Persona UTIC original',entregaRun:'',entregaCorreo:'utic@example.org',entregaCargo:'UTIC',recibeRun:'',recibeCorreo:'receptor@example.org',recibeCargo:'Director/a',recibeUnidad:'',recibeSubdireccion:'',accesorios:'Accesorios originales',observaciones:'Observación original'}))f.set(k,v);
   const respuesta=await post(ruta,f,ca);assert.equal(respuesta.status,303,await respuesta.text());
   const acta=(await db.query('SELECT * FROM public.actas_documentos WHERE id=$1',[f.get('actaSolicitud')])).rows[0];assert.ok(acta?.pdf);assert.equal(acta.datos.actor,usuarios.administrador_gestion);assert.equal(acta.datos.receptorNombre,'Persona receptora original');assert.equal(acta.datos.metadata.entregaNombre,'Persona UTIC original');
   const bien=acta.datos.bienes[0];assert.equal(bien.estado_administrativo??bien.estadoAdministrativo,'activo');assert.equal(bien.condicion_tecnica??bien.condicionTecnica,'operativo');
   const hash=createHash('sha256').update(acta.pdf).digest('hex'),folio=acta.folio;assert.equal(hash,acta.sha256);
   await guardar(clase,documentado,'robado','operativo');await guardar(clase,documentado,'no_encontrado','');await guardar(clase,documentado,'activo','mal_estado');await guardar(clase,documentado,'dado_de_baja','operativo');
   const actual=await leer(clase,documentado);assert.equal(actual.estado_administrativo,'dado_de_baja');assert.equal(actual.condicion_tecnica,'obsoleto');assert.ok(actual.fecha_baja);
   for(const query of ['', '?descargar=si']){const r=await pedir('/inventario/actas/'+acta.id+'/pdf'+query,cs);assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);const pdf=Buffer.from(await r.arrayBuffer());assert.deepEqual(pdf,acta.pdf);assert.equal(createHash('sha256').update(pdf).digest('hex'),hash);}
   const conservada=(await db.query('SELECT * FROM public.actas_documentos WHERE id=$1',[acta.id])).rows[0];assert.equal(conservada.folio,folio);assert.deepEqual(conservada.datos,acta.datos);assert.equal(conservada.sha256,hash);
   for(const c of [cc,undefined])assert.equal((await pedir('/inventario/actas/'+acta.id+'/pdf',c)).headers.get('location'),c?'/sin-permiso':'/ingresar');
   const html=await contenidoFicha(clase,documentado,ca);assert.ok(html.includes('Registro archivado como histórico. Solo lectura.'));assert.ok(html.includes('/inventario/actas/'+acta.id));assert.ok(!html.includes('movimiento=asignacion'));assert.ok(!html.includes('movimiento=devolucion'));
   for(const administrativo of ['activo','robado','no_encontrado','dado_de_baja'])await assert.rejects(guardar(clase,documentado,administrativo,'operativo'),codigo('P3002'));
   await assert.rejects(mover(await movimiento(clase,documentado,'devolucion')),codigo('P3002'));
   if(clase==='equipo')await assert.rejects(app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,$3,$4)',[usuarios.administrador_gestion,JSON.stringify({id:documentado,sedeId:actual.sede_id,categoriaId:actual.categoria_id,marca:actual.marca,modelo:'Cambio indebido',serie:actual.serie,inventario:actual.numero_inventario,motivoIdentificacion:'',origen:actual.origen,condicionTecnica:'operativo',observaciones:'',compra:{}}),actual.version,'Intento ficticio en histórico']),codigo('P3002'));
   else await assert.rejects(app.query('SELECT public.guardar_celular_acceso($1,$2,$3::jsonb,$4,$5)',[usuarios.administrador_gestion,documentado,JSON.stringify({sedeId:actual.sede_id,telefono:actual.telefono,marca:actual.marca,modelo:'Cambio indebido',imei:'',inventario:actual.numero_inventario,condicionTecnica:'operativo',responsable:actual.responsable,observaciones:'',activo:true}),actual.version,'Intento ficticio en histórico']),codigo('P3002'));
   assert.deepEqual(await leer(clase,documentado),actual);
  });
 }
 await caso('el número de un celular dado de baja puede reutilizarse sin alterar su histórico',async()=>{
  const anterior=await crear('celular');await guardar('celular',anterior,'dado_de_baja','operativo');const historico=await leer('celular',anterior),nuevo=randomUUID();
  assert.equal(historico.activo,true);assert.equal(historico.estado_administrativo,'dado_de_baja');
  await app.query('SELECT public.guardar_celular_acceso($1,$2,$3::jsonb,0,$4)',[usuarios.administrador_gestion,nuevo,JSON.stringify({sedeId:sedes[0],telefono:historico.telefono,marca:'Marca ficticia',modelo:'Celular de reemplazo '+sufijo,imei:'',inventario:'EST-REUSO-'+randomUUID(),condicionTecnica:'operativo',responsable:'Persona ficticia',observaciones:'Número conservado en su histórico anterior',activo:true,custodiaInicial:'en_bodega'}),'Alta ficticia de reemplazo']);
  creados.push({clase:'celular',id:nuevo});assert.equal((await leer('celular',nuevo)).telefono,historico.telefono);assert.equal((await leer('celular',nuevo)).estado_administrativo,'activo');assert.deepEqual(await leer('celular',anterior),historico);
  assert.equal((await db.query('SELECT count(*) FROM public.celulares WHERE telefono=$1',[historico.telefono])).rows[0].count,'2');
  await assert.rejects(guardar('celular',anterior,'activo','operativo'),codigo('P3002'));assert.deepEqual(await leer('celular',anterior),historico);
 });
 await caso('incidente abierto impide volver a Activo y conserva el seguimiento',async()=>{
  const id=await crear('equipo','asignado'),reporte={sedeId:sedes[0],fecha,lugar:'Lugar ficticio',descripcion:'Incidente ficticio de la prueba de estados',enlace:'',equipos:[{id,version:(await leer('equipo',id)).version}]},incidente=randomUUID();
  await db.query('SELECT public.reportar_robo_historico_interno($1,$2::uuid,$3::jsonb)',[usuarios.administrador_gestion,incidente,JSON.stringify(reporte)]);await guardar('equipo',id,'robado','');const antes=await leer('equipo',id);
  await assert.rejects(guardar('equipo',id,'activo','operativo'),codigo('P3004'));assert.deepEqual(await leer('equipo',id),antes);assert.equal((await db.query('SELECT estado FROM public.incidentes_robos WHERE id=$1',[incidente])).rows[0].estado,'reportado');
 });
 await caso('la aplicación no escribe directamente el registro ni el historial de estados',async()=>{
  for(const tabla of ['equipos','celulares','cambios_estados_activo'])for(const permiso of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await app.query('SELECT has_table_privilege(current_user,$1,$2) AS ok',['public.'+tabla,permiso])).rows[0].ok,false);
 });
 await caso('cuenta revocada no cambia estados ni abre la ficha',async()=>{
  const id=await crear('equipo');await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=$1',[usuarios.administrador]);
  await assert.rejects(guardar('equipo',id,'robado','',usuarios.administrador),codigo('42501'));assert.equal((await pedir(ficha('equipo',id),cs)).headers.get('location'),'/acceso-denegado');
 });
 console.log('Estados integrados: '+pruebas+' escenarios SQL/HTTP/PDF aprobados: permisos, tres reglas, cinco condiciones, reintentos, versiones, concurrencia, baja terminal, movimientos, préstamos, incidentes y documentos conservados.');
}finally{
 // Los históricos y actas de esta base efímera se conservan para no falsear una baja.
 await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=ANY($1)',[Object.values(usuarios)]);
 await app.end();await db.end();
}
