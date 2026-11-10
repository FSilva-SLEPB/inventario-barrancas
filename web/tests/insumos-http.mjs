// Base efímera y sesiones ficticias. Nunca usa correos reales ni modifica el host.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';

const {encode}=createRequire(import.meta.url)('next-auth/jwt'),origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID(),randomUUID()],productos=[],solicitudes=[];
const usuarios=Object.fromEntries(['administrador','administrador_gestion','consulta','encargado','consulta_sede'].map(r=>[r,'insumos-'+r+'-'+sufijo+'@slepb.gob.cl']));
const cookie=async correo=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:correo},maxAge:900});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:c?{Cookie:c}:{}});
const post=(ruta,f,c,origin=new URL(origen).origin)=>fetch(origen+ruta,{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:origin},body:f});
const sha=b=>createHash('sha256').update(b).digest('hex');
const datosProducto=(n,c={})=>({codigo:'QA-'+n+'-'+sufijo,nombre:'Insumo '+n+' '+sufijo,categoria:'Accesorios ficticios',unidad:'caja',activo:true,...c});
const guardarProducto=(actor,id,datos,cliente=app)=>cliente.query('SELECT public.guardar_producto_insumo_acceso($1,$2::uuid,$3::jsonb) AS r',[actor,id,JSON.stringify(datos)]);
const ingresar=(actor,id,producto,cantidad,cliente=app)=>cliente.query('SELECT public.ingresar_stock_insumo_acceso($1,$2::uuid,$3::uuid,$4::integer) AS r',[actor,id,producto,cantidad]);
const idResultado=r=>typeof r.rows[0].r==='string'?r.rows[0].r:r.rows[0].r.id;
const catalogo=async id=>(await db.query('SELECT * FROM public.catalogo_insumos WHERE id=$1',[id])).rows[0];
const stock=async id=>(await db.query('SELECT existencia,reservado FROM public.stock_insumos WHERE producto_id=$1',[id])).rows[0];
const solicitud=async id=>(await db.query('SELECT * FROM public.solicitudes_insumos WHERE id=$1',[id])).rows[0];
const crear=(actor,sede,lineas,datos={})=>app.query('SELECT public.crear_solicitud_insumos($1,$2::uuid,$3::jsonb,$4::jsonb) AS id',[actor,sede,JSON.stringify(lineas),JSON.stringify(datos)]);
const validar=(id,actor=usuarios.administrador_gestion)=>app.query('SELECT public.validar_solicitud_insumos($1,$2::uuid,$3)',[actor,id,'Revisión ficticia']);
const aprobar=(id,lineas,actor=usuarios.administrador_gestion)=>app.query('SELECT public.aprobar_solicitud_insumos($1,$2::uuid,$3::jsonb)',[actor,id,JSON.stringify({lineas,motivo:'Aprobación ficticia'})]);
const entregar=(id,datos,actor=usuarios.administrador_gestion)=>app.query('SELECT public.entregar_solicitud_insumos($1,$2::uuid,$3::jsonb) AS r',[actor,id,JSON.stringify(datos)]);
const cancelar=(id,actor=usuarios.administrador_gestion)=>app.query('SELECT public.cancelar_solicitud_insumos($1,$2::uuid,$3)',[actor,id,'Cancelación ficticia']);
const fecha=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Santiago'});
const aprobacion=(producto,cantidad)=>({producto_id:producto,cantidad_aprobada:cantidad,motivo_reduccion:''});
const entrega=(lineas,c={})=>({receptor:'Persona receptora ficticia',responsable_ti:'Persona UTIC ficticia',fecha_entrega:fecha,observaciones:'Observaciones de ensayo',lineas,...c});
const codigo=c=>e=>e.code===c;
const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
function formulario(html,marca){
 const bloque=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(s=>s.includes(marca));assert.ok(bloque,'Formulario presente: '+marca);
 const f=new FormData();
 for(const[t]of bloque.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(t)?.[1];if(n)f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(t)?.[1]??''));}
 for(const[,n,v]of bloque.matchAll(/<textarea\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/textarea>/g))f.append(dec(n),dec(v));
 for(const[,n,v]of bloque.matchAll(/<select\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const selected=/<option\b[^>]*value="([^"]*)"[^>]*selected/.exec(v)?.[1]??/<option\b[^>]*value="([^"]*)"/.exec(v)?.[1]??'';f.append(dec(n),dec(selected));}
 return f;
}
const clonar=f=>{const c=new FormData();for(const[k,v]of f)c.append(k,v);return c;};
async function nueva(sede,lineas,actor=usuarios.encargado){const id=(await crear(actor,sede,lineas,{nombre:'Solicitante '+sufijo,run:'12345678-5',cargo:'Cargo ficticio',telefono:'900000000',modalidad:'RETIRO_SERVICIO',motivo:'Ensayo aislado'})).rows[0].id;solicitudes.push(id);return id;}
const meta={entregaNombre:'Persona UTIC ficticia',entregaRun:'',entregaCargo:'UTIC',entregaCorreo:'utic@example.org',recibeRun:'',recibeCargo:'Director/a',recibeCorreo:'receptor@example.org',recibeUnidad:'',recibeSubdireccion:'',accesorios:'',observaciones:'Ensayo aislado',fechaEntrega:fecha,recibeNombre:'Persona receptora ficticia'};
let pruebas=0;
async function caso(nombre,fn){try{await fn();pruebas++;}catch(e){throw new Error('Insumos: '+nombre,{cause:e});}}
await db.connect();await app.connect();
try{
 for(const[i,id]of sedes.entries())await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,activo,direccion,comuna) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,i===1?'jardin_infantil':'establecimiento','Sede insumos '+i+' '+sufijo,'INS-'+i+'-'+sufijo,i!==2,'Dirección ficticia','Comuna ficticia']);
 for(const[rol,correo]of Object.entries(usuarios))await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',correo,'Persona ficticia',rol,['encargado','consulta_sede'].includes(rol)?sedes[0]:null]);
 const ca=await cookie(usuarios.administrador_gestion),cl=await cookie(usuarios.encargado),cc=await cookie(usuarios.consulta),cle=await cookie(usuarios.consulta_sede);
 let p1,p2,p3,p4,p5;
 await caso('el rol app crea y actualiza catálogo mediante funciones autorizadas',async()=>{
  for(const n of [1,2,3,4,5]){const datos=datosProducto(n,{unidad:n===2?'unidad':'caja'}),peticion=randomUUID(),id=idResultado(await guardarProducto(usuarios.administrador_gestion,peticion,datos));assert.equal(idResultado(await guardarProducto(usuarios.administrador_gestion,peticion,datos)),id,'Reintentar alta no crea otro producto');assert.match(id,/^[a-f0-9-]{36}$/);productos.push(id);assert.equal((await catalogo(id)).nombre,datos.nombre);assert.deepEqual(await stock(id),{existencia:0,reservado:0});}
  [p1,p2,p3,p4,p5]=productos;const actual=await catalogo(p3);await guardarProducto(usuarios.administrador,randomUUID(),{id:p3,codigo:actual.codigo,nombre:'Nombre editado '+sufijo,categoria:actual.categoria,unidad:actual.unidad,activo:false,version:actual.version});assert.equal((await catalogo(p3)).activo,false);assert.equal((await catalogo(p3)).nombre,'Nombre editado '+sufijo);
 });
 await caso('consulta y perfiles locales no alteran catálogo ni stock',async()=>{
  for(const rol of ['consulta','encargado','consulta_sede']){await assert.rejects(guardarProducto(usuarios[rol],randomUUID(),datosProducto('indebido')),codigo('42501'));await assert.rejects(ingresar(usuarios[rol],randomUUID(),p1,5),codigo('42501'));}assert.deepEqual(await stock(p1),{existencia:0,reservado:0});
 });
 await caso('ingreso de stock idempotente e inputs inválidos sin truncar cantidades',async()=>{
  const id=randomUUID();await ingresar(usuarios.administrador_gestion,id,p1,20);await ingresar(usuarios.administrador_gestion,id,p1,20);assert.deepEqual(await stock(p1),{existencia:20,reservado:0});await assert.rejects(ingresar(usuarios.administrador_gestion,id,p1,21));
  for(const n of [-1,0,100001,1.5])await assert.rejects(ingresar(usuarios.administrador_gestion,randomUUID(),p1,n));assert.deepEqual(await stock(p1),{existencia:20,reservado:0});await ingresar(usuarios.administrador,randomUUID(),p2,10);await ingresar(usuarios.administrador,randomUUID(),p4,5);
 });
 await caso('no convierte unidades con existencias o solicitudes abiertas',async()=>{
  const cambiarUnidad=async id=>{const c=await catalogo(id);await assert.rejects(guardarProducto(usuarios.administrador_gestion,randomUUID(),{id,codigo:c.codigo,nombre:c.nombre,categoria:c.categoria,unidad:'unidad',activo:c.activo,version:c.version}));assert.deepEqual(await catalogo(id),c);};
  await cambiarUnidad(p1);assert.deepEqual(await stock(p1),{existencia:20,reservado:0});
  await nueva(sedes[0],[{producto_id:p5,cantidad:1}]);assert.deepEqual(await stock(p5),{existencia:0,reservado:0});await cambiarUnidad(p5);assert.deepEqual(await stock(p5),{existencia:0,reservado:0});
 });
 await caso('consulta no solicita y un encargado no solicita por otra sede',async()=>{
  for(const rol of ['consulta','consulta_sede'])await assert.rejects(crear(usuarios[rol],sedes[0],[{producto_id:p1,cantidad:1}]),codigo('42501'));
  await assert.rejects(crear(usuarios.encargado,sedes[1],[{producto_id:p1,cantidad:1}]),codigo('42501'));
  await assert.rejects(crear(usuarios.administrador_gestion,sedes[2],[{producto_id:p1,cantidad:1}]));
 });
 await caso('carrito único, cantidades enteras y productos activos',async()=>{
  const antes=(await db.query('SELECT count(*) FROM public.solicitudes_insumos WHERE solicitante_correo=$1',[usuarios.encargado])).rows[0].count;
  for(const lineas of [[],[{producto_id:p1,cantidad:1},{producto_id:p1,cantidad:2}],[{producto_id:p1,cantidad:1},{producto_id:p1.toUpperCase(),cantidad:2}],[{producto_id:p1,cantidad:1.5}],[{producto_id:p1,cantidad:0}],[{producto_id:p3,cantidad:1}],[{producto_id:randomUUID(),cantidad:1}]])await assert.rejects(crear(usuarios.encargado,sedes[0],lineas));
  assert.equal((await db.query('SELECT count(*) FROM public.solicitudes_insumos WHERE solicitante_correo=$1',[usuarios.encargado])).rows[0].count,antes);assert.deepEqual(await stock(p1),{existencia:20,reservado:0});
 });
 const a=await nueva(sedes[0],[{producto_id:p1,cantidad:5},{producto_id:p2,cantidad:4}]),ajena=await nueva(sedes[1],[{producto_id:p2,cantidad:1}],usuarios.administrador_gestion);
 await caso('aislamiento de listados, detalle y filtros manipulados',async()=>{
  for(const ruta of ['/insumos/seguimiento','/insumos/historial']){for(const c of [cl,cle]){const r=await pedir(ruta+'?q='+sufijo+'&sede='+sedes[1]+'&ver='+ajena,c),html=await r.text();assert.ok(!html.includes('<h2>Solicitud '+ajena.slice(0,8)),'No renderiza el detalle de la solicitud ajena');assert.ok(!html.includes('Sede insumos 1 '+sufijo),'No serializa nombre de sede ajena');}const propio=await(await pedir(ruta+'?ver='+a,cl)).text();assert.ok(propio.includes(a));}
 });
 await caso('solo UTIC valida, aprueba, cancela y entrega',async()=>{
  for(const rol of ['consulta','encargado','consulta_sede']){await assert.rejects(validar(a,usuarios[rol]),codigo('42501'));await assert.rejects(aprobar(a,[aprobacion(p1,5)],usuarios[rol]),codigo('42501'));await assert.rejects(cancelar(a,usuarios[rol]),codigo('42501'));await assert.rejects(entregar(a,entrega([{producto_id:p1,cantidad_entregada:1}]),usuarios[rol]),codigo('42501'));}assert.equal((await solicitud(a)).estado,'solicitada');
 });
 await validar(a);
 await caso('no reserva productos ajenos, repetidos, fraccionados ni cantidades excesivas',async()=>{
  for(const lineas of [[aprobacion(p1,1),aprobacion(p1,1),aprobacion(p2,4)],[aprobacion(p1,1),aprobacion(p1.toUpperCase(),1)],[aprobacion(p4,1),aprobacion(p2,4)],[aprobacion(p1,6),aprobacion(p2,4)],[aprobacion(p1,1.5),aprobacion(p2,4)],[aprobacion(p1,-1),aprobacion(p2,4)]])await assert.rejects(aprobar(a,lineas));
  assert.equal((await solicitud(a)).estado,'en_validacion');assert.deepEqual(await stock(p1),{existencia:20,reservado:0});assert.deepEqual(await stock(p2),{existencia:10,reservado:0});assert.equal((await db.query('SELECT count(*) FROM public.reservas_insumos WHERE solicitud_id=$1',[a])).rows[0].count,'0');
 });
 await aprobar(a,[aprobacion(p1,5),aprobacion(p2,4)]);
 const b=await nueva(sedes[0],[{producto_id:p1,cantidad:2}]);await validar(b);await aprobar(b,[aprobacion(p1,2)]);
 await caso('aprobación reserva una sola vez y mantiene otras solicitudes',async()=>{
  assert.deepEqual(await stock(p1),{existencia:20,reservado:7});assert.deepEqual(await stock(p2),{existencia:10,reservado:4});assert.equal((await aprobar(a,[aprobacion(p1,5),aprobacion(p2,4)])).rows[0].aprobar_solicitud_insumos.repetida,true);assert.deepEqual(await stock(p1),{existencia:20,reservado:7});
 });
 await caso('no emite acta antes de registrar la entrega',async()=>{
  const n=(await db.query('SELECT ultimo FROM public.actas_contador')).rows[0].ultimo;await assert.rejects(app.query('SELECT public.preparar_acta_insumo_acceso($1,$2::uuid,$3::uuid,$4::jsonb,$5::jsonb)',[usuarios.administrador_gestion,randomUUID(),a,JSON.stringify(meta),JSON.stringify([{producto_id:p1,cantidad_entregada:3}])]));assert.equal((await db.query('SELECT ultimo FROM public.actas_contador')).rows[0].ultimo,n);assert.equal((await solicitud(a)).estado,'aprobada');
 });
 await caso('entrega rechaza duplicados equivalentes, excesos y fechas futuras sin consumir reservas',async()=>{
  const antes1=await stock(p1),antes2=await stock(p2);
  for(const lineas of [[{producto_id:p1,cantidad_entregada:1},{producto_id:p1.toUpperCase(),cantidad_entregada:1}],[{producto_id:p1,cantidad_entregada:6}],[{producto_id:p1,cantidad_entregada:1.5}],[{producto_id:p4,cantidad_entregada:1}]])await assert.rejects(entregar(a,entrega(lineas)));
  await assert.rejects(entregar(a,entrega([{producto_id:p1,cantidad_entregada:1}],{fecha_entrega:'2099-01-01'})));
  assert.deepEqual(await stock(p1),antes1);assert.deepEqual(await stock(p2),antes2);assert.equal((await solicitud(a)).estado,'aprobada');assert.equal((await db.query('SELECT count(*) FROM public.entregas_insumos WHERE solicitud_id=$1',[a])).rows[0].count,'0');
 });
 await caso('validar, aprobar y cancelar conservan filtros sin permitir destinos ajenos',async()=>{
  const id=await nueva(sedes[0],[{producto_id:p4,cantidad:1}]);const base='/insumos/seguimiento?q='+sufijo+'&limite=100&pagina=2';
  for(const[paso,marca]of [['validar','name="observacion"'],['aprobar','name="cant_aprobada_'],['cancelar','name="motivo"']]){const ruta=base+'&ver='+id+'&paso='+paso,html=await(await pedir(ruta,ca)).text(),f=formulario(html,marca);if(paso==='cancelar')f.set('motivo','Cancelación de ensayo');const r=await post(ruta,f,ca);assert.equal(r.status,303,await r.text());const u=new URL(r.headers.get('location'),origen);assert.equal(u.pathname,'/insumos/seguimiento');assert.equal(u.searchParams.get('q'),sufijo);assert.equal(u.searchParams.get('limite'),'100');assert.equal(u.searchParams.get('paso'),null);}
  assert.equal((await solicitud(id)).estado,'cancelada');
 });
 await caso('formulario de entrega precarga participantes y no admite cantidades fraccionadas por HTTP',async()=>{
  for(const rol of ['consulta','consulta_sede']){const r=await pedir('/insumos/solicitud',await cookie(usuarios[rol]));assert.ok([303,307].includes(r.status));assert.equal(new URL(r.headers.get('location'),origen).pathname,'/sin-permiso');}
  const ruta='/insumos/seguimiento?ver='+a+'&paso=entregar&limite=100&pagina=2',html=await(await pedir(ruta,ca)).text();assert.ok(html.includes('modal-ficha'));const f=formulario(html,'name="responsable_ti"');assert.equal(f.get('responsable_ti'),'Persona ficticia');assert.equal(f.get('receptor'),'Solicitante '+sufijo);assert.equal(f.get('recibeRun'),'12345678-5');assert.equal(f.get('entregaCorreo'),usuarios.administrador_gestion);assert.equal(new URL(f.get('volver'),origen).searchParams.get('limite'),'100');
  const antes=await stock(p1);f.set('cant_entregada_'+p1,'2');f.set('cant_entregada_'+p2,'1.5');const r=await post(ruta,f,ca);assert.equal(r.status,200);assert.match(await r.text(),/cantidades enteras/);assert.deepEqual(await stock(p1),antes);assert.equal((await solicitud(a)).estado,'aprobada');
 });
 await caso('fallo del PDF revierte entrega, stock, reservas y folio',async()=>{
  const ruta='/insumos/seguimiento?ver='+a+'&paso=entregar',f=formulario(await(await pedir(ruta,ca)).text(),'name="responsable_ti"');
  for(const[k,v]of Object.entries({receptor:'Persona receptora original',responsable_ti:'Persona UTIC original',fecha_entrega:fecha,recibeRun:'',recibeCargo:'Director/a',entregaCargo:'UTIC',observaciones:'Entrega parcial finalizada',['cant_entregada_'+p1]:'3',['cant_entregada_'+p2]:'0'}))f.set(k,v);
  const anterior=await solicitud(a),antes1=await stock(p1),antes2=await stock(p2),folio=(await db.query('SELECT ultimo FROM public.actas_contador')).rows[0].ultimo;
  try{await db.query('ALTER FUNCTION public.completar_pdf_acta_acceso(text,uuid,bytea) RENAME TO completar_pdf_insumos_ensayo');const r=await post(ruta,f,ca);assert.equal(r.status,200);}finally{await db.query('ALTER FUNCTION public.completar_pdf_insumos_ensayo(text,uuid,bytea) RENAME TO completar_pdf_acta_acceso');}
  assert.deepEqual(await solicitud(a),anterior);assert.deepEqual(await stock(p1),antes1);assert.deepEqual(await stock(p2),antes2);assert.equal((await db.query('SELECT ultimo FROM public.actas_contador')).rows[0].ultimo,folio);assert.equal((await db.query('SELECT count(*) FROM public.entregas_insumos WHERE solicitud_id=$1',[a])).rows[0].count,'0');assert.equal((await db.query('SELECT count(*) FROM public.actas_documentos WHERE solicitud_insumo_id=$1',[a])).rows[0].count,'0');
 });
 let acta;
 await caso('contra entrega HTTP parcial cierra y libera toda su reserva sin tocar otras',async()=>{
  const ruta='/insumos/seguimiento?ver='+a+'&paso=entregar',html=await(await pedir(ruta,ca)).text(),f=formulario(html,'name="responsable_ti"');for(const[k,v]of Object.entries({receptor:'Persona receptora original',responsable_ti:'Persona UTIC original',fecha_entrega:fecha,recibeRun:'',recibeCargo:'Director/a',entregaCargo:'UTIC',observaciones:'Entrega parcial finalizada',['cant_entregada_'+p1]:'3',['cant_entregada_'+p2]:'0'}))f.set(k,v);
  const r=await post(ruta,f,ca);assert.equal(r.status,303,await r.text());const despues=await solicitud(a);assert.equal(despues.estado,'entregada');assert.ok(despues.acta_id);assert.equal(new URL(r.headers.get('location'),origen).pathname,'/inventario/actas/'+despues.acta_id);
  assert.deepEqual(await stock(p1),{existencia:17,reservado:2});assert.deepEqual(await stock(p2),{existencia:10,reservado:0});assert.equal((await db.query('SELECT count(*) FROM public.reservas_insumos WHERE solicitud_id=$1 AND consumida_en IS NULL AND liberada_en IS NULL',[a])).rows[0].count,'0');assert.equal((await solicitud(b)).estado,'aprobada');
  const repetido=await post(ruta,clonar(f),ca);assert.equal(repetido.status,303,await repetido.text());assert.equal((await solicitud(a)).acta_id,despues.acta_id);assert.deepEqual(await stock(p1),{existencia:17,reservado:2});assert.equal((await db.query('SELECT count(*) FROM public.entregas_insumos WHERE solicitud_id=$1',[a])).rows[0].count,'1');
  acta=(await db.query('SELECT * FROM public.actas_documentos WHERE id=$1',[despues.acta_id])).rows[0];assert.ok(acta?.pdf);
 });
 await caso('Todos incluye finalizadas y no acepta guardados inventados por URL',async()=>{
  const todos=await(await pedir('/insumos/seguimiento?q='+sufijo+'&estado=&guardado=1',ca)).text();assert.ok(todos.includes('ver='+a));assert.ok(!todos.includes('Cambios guardados.'));
  const activas=await(await pedir('/insumos/seguimiento?q='+sufijo+'&estado=activas',ca)).text();assert.ok(!activas.includes('ver='+a));
 });
 await caso('acta y correo regresan al listado de insumos conservando sus filtros',async()=>{
  const volver='/insumos/historial?q='+sufijo+'&limite=100&pagina=2',ruta='/inventario/actas/'+acta.id+'?'+new URLSearchParams({volver});const html=await(await pedir(ruta,ca)).text();assert.ok(html.includes('Volver a insumos'));assert.ok(html.includes('limite=100'));const correo=await(await pedir(ruta+'&correo=si',ca)).text(),f=formulario(correo,'name="destinatarios"');assert.equal(f.get('volver'),volver);assert.equal(f.get('acta'),acta.id);assert.deepEqual((await db.query('SELECT pdf FROM public.actas_documentos WHERE id=$1',[acta.id])).rows[0].pdf,acta.pdf);
 });
 await caso('acta conserva producto, unidad, cantidad y bytes en consulta/descarga',async()=>{
  const local=await(await pedir('/insumos/historial?ver='+a,cl)).text();assert.ok(!local.includes('/inventario/actas/'+acta.id),'La sede no ve botones de documentos reservados a UTIC');
  const item=acta.datos.bienes.find(x=>x.producto_id===p1);assert.ok(item);assert.equal(item.nombre,'Insumo 1 '+sufijo);assert.equal(item.unidad,'caja');assert.equal(item.cantidad_entregada,3);assert.equal(acta.datos.bienes.reduce((n,x)=>n+Number(x.cantidad_entregada),0),3);assert.equal(acta.datos.receptorNombre,'Persona receptora original');assert.equal(acta.datos.metadata.entregaNombre,'Persona UTIC original');
  const ficha=await(await pedir('/inventario/actas/'+acta.id,ca)).text();for(const texto of ['Imprimir','Descargar PDF','Enviar por correo'])assert.ok(ficha.includes(texto));
  for(const q of ['', '?descargar=si']){const r=await pedir('/inventario/actas/'+acta.id+'/pdf'+q,ca);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/pdf');assert.match(r.headers.get('cache-control'),/private.*no-store/);const pdf=Buffer.from(await r.arrayBuffer());assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.equal(sha(pdf),acta.sha256);assert.deepEqual(pdf,acta.pdf);}
  const c=await catalogo(p1);await guardarProducto(usuarios.administrador_gestion,randomUUID(),{id:p1,codigo:c.codigo,nombre:'Nombre posterior '+sufijo,categoria:c.categoria,unidad:c.unidad,activo:true,version:c.version});assert.deepEqual(Buffer.from(await(await pedir('/inventario/actas/'+acta.id+'/pdf',ca)).arrayBuffer()),acta.pdf);assert.deepEqual((await db.query('SELECT datos FROM public.actas_documentos WHERE id=$1',[acta.id])).rows[0].datos,acta.datos);
 });
 await caso('no vincula un acta ajena a otra solicitud',async()=>{
  const c=await nueva(sedes[0],[{producto_id:p1,cantidad:1}]);await validar(c);await aprobar(c,[aprobacion(p1,1)]);const antes=await stock(p1);await assert.rejects(entregar(c,entrega([{producto_id:p1,cantidad_entregada:1}],{acta_id:acta.id})));assert.deepEqual(await stock(p1),antes);assert.equal((await solicitud(c)).estado,'aprobada');await cancelar(c);
 });
 await caso('cancelación libera solamente las reservas vigentes de su solicitud',async()=>{await cancelar(b);assert.deepEqual(await stock(p1),{existencia:17,reservado:0});assert.deepEqual(await stock(p2),{existencia:10,reservado:0});assert.equal((await solicitud(b)).estado,'cancelada');});
 await caso('la base deniega DML directo en catálogo, stock, solicitudes y reservas',async()=>{
  for(const tabla of ['catalogo_insumos','stock_insumos','solicitudes_insumos','solicitudes_insumos_detalle','reservas_insumos','entregas_insumos','entregas_insumos_detalle'])for(const permiso of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await app.query('SELECT has_table_privilege(current_user,$1,$2) AS ok',['public.'+tabla,permiso])).rows[0].ok,false);
 });
 await caso('fotos autenticadas, validación de contenido y CSRF de los dos POST',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),imagen=()=>{const f=new FormData();f.set('imagen',new File([png],'ficticia.png',{type:'image/png'}));return f;};
  const cruzada=await post('/api/insumos/imagen',imagen(),ca,'https://origen-ajeno.example.org');assert.ok(cruzada.status>=400&&cruzada.status<500);
  for(const c of [cl,cc]){const r=await post('/api/insumos/imagen',imagen(),c);assert.ok(r.status>=300&&r.status<500);}
  const falso=new FormData();falso.set('imagen',new File([Buffer.from('<html>no es PNG</html>')],'falsa.png',{type:'image/png'}));const rf=await post('/api/insumos/imagen',falso,ca);assert.ok(rf.status>=400&&rf.status<500);
  const subida=await post('/api/insumos/imagen',imagen(),ca);assert.ok([200,201].includes(subida.status),await subida.clone().text());const json=await subida.json();assert.equal(typeof json.url,'string');assert.ok(json.url.startsWith('/api/insumos/imagen'));
  const asignar=()=>{const f=new FormData();f.set('producto_id',p1);f.set('foto_url',json.url);return f;},csrf=await post('/api/insumos/producto',asignar(),ca,'https://origen-ajeno.example.org');assert.ok(csrf.status>=400&&csrf.status<500);
  const r=await post('/api/insumos/producto',asignar(),ca);assert.equal(r.status,200,await r.text());assert.equal((await catalogo(p1)).foto_url,json.url);
  const bytes=await pedir(json.url,cc);assert.equal(bytes.status,200);assert.equal(bytes.headers.get('content-type'),'image/png');assert.match(bytes.headers.get('cache-control'),/private.*no-store/);assert.deepEqual(Buffer.from(await bytes.arrayBuffer()),png);
  const anon=await pedir(json.url);assert.ok(anon.status>=300&&anon.status<500);assert.notEqual(anon.headers.get('content-type'),'image/png');
 });
 console.log('Insumos: '+pruebas+' escenarios SQL/HTTP/PDF/fotos aprobados: roles, aislamiento por sede, catálogo/stock con rol app, reservas, entrega parcial única, acta conservada, imágenes persistentes y CSRF.');
}finally{
 // Conservar documentos/stock de la base efímera; desactivar solo usuarios de ensayo.
 await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=ANY($1)',[Object.values(usuarios)]);
 await app.end();await db.end();
}
