// Base efímera y sesiones ficticias. Nunca usa correos reales ni modifica el host.
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';

const {encode}=createRequire(import.meta.url)('next-auth/jwt'),origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID(),randomUUID()],solicitudes=[];
const usuarios=Object.fromEntries(['administrador','administrador_gestion','consulta','encargado','consulta_sede','gestor_insumos'].map(r=>[r,'insumos-'+r+'-'+sufijo+'@slepb.gob.cl']));
const cookie=async correo=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:correo},maxAge:900});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:c?{Cookie:c}:{}});
const post=(ruta,f,c,origin=new URL(origen).origin)=>fetch(origen+ruta,{method:'POST',redirect:'manual',headers:{Cookie:c,Origin:origin},body:f});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ingresar=(actor,id,producto,cantidad,cliente=app)=>cliente.query('SELECT public.ingresar_stock_insumo_acceso($1,$2::uuid,$3::uuid,$4::integer) AS r',[actor,id,producto,cantidad]);
const stock=async id=>(await db.query('SELECT existencia,reservado FROM public.stock_insumos WHERE producto_id=$1',[id])).rows[0];
const solicitud=async id=>(await db.query('SELECT * FROM public.solicitudes_insumos WHERE id=$1',[id])).rows[0];
const crear=(actor,sede,lineas,datos={})=>app.query('SELECT public.crear_solicitud_insumos($1,$2::uuid,$3::jsonb,$4::jsonb) AS id',[actor,sede,JSON.stringify(lineas),JSON.stringify(datos)]);
const validar=(id,actor=usuarios.administrador_gestion)=>app.query('SELECT public.validar_solicitud_insumos($1,$2::uuid,$3)',[actor,id,'Revisión ficticia']);
const aprobar=(id,lineas,actor=usuarios.administrador_gestion)=>app.query('SELECT public.aprobar_solicitud_insumos($1,$2::uuid,$3::jsonb)',[actor,id,JSON.stringify({lineas,motivo:'Aprobación ficticia'})]);
const cancelar=(id,actor=usuarios.administrador_gestion)=>app.query('SELECT public.cancelar_solicitud_insumos($1,$2::uuid,$3)',[actor,id,'Cancelación ficticia']);
const fecha=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Santiago'});
const aprobacion=(producto,cantidad)=>({producto_id:producto,cantidad_aprobada:cantidad,motivo_reduccion:''});
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
async function nueva(sede,lineas,actor=usuarios.encargado){const id=(await crear(actor,sede,lineas,{nombre:'Solicitante '+sufijo,run:'12345678-5',cargo:'Cargo ficticio',telefono:'900000000',modalidad:'RETIRO_SERVICIO',motivo:'Ensayo aislado'})).rows[0].id;solicitudes.push(id);return id;}
let pruebas=0;
async function caso(nombre,fn){try{await fn();pruebas++;}catch(e){throw new Error('Gestor de insumos: '+nombre,{cause:e});}}
await db.connect();await app.connect();
try{
 for(const[i,id]of sedes.entries())await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,activo) VALUES($1,$2,$3,$4,true)',[id,i===1?'jardin_infantil':'establecimiento','Sede gestor '+i+' '+sufijo,'GEST-'+i+'-'+sufijo]);
 for(const[rol,correo]of Object.entries(usuarios).filter(([rol])=>rol!=='gestor_insumos'))await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',correo,'Persona ficticia',rol,['encargado','consulta_sede'].includes(rol)?sedes[0]:null]);
 const gestor=usuarios.gestor_insumos;
 await caso('administrador de gestión concede gestor, sin conceder administración a este',async()=>{
  await app.query("SELECT public.guardar_usuario_acceso($1,$2,'Gestor ficticio','gestor_insumos',true,0,NULL)",[usuarios.administrador_gestion,gestor]);
  assert.equal((await db.query('SELECT rol FROM public.usuarios_acceso WHERE correo=$1',[gestor])).rows[0].rol,'gestor_insumos');
  await assert.rejects(app.query('SELECT public.guardar_dependencia_acceso($1,NULL,$2,$3,true)',[gestor,sedes[0],'Dependencia indebida']),codigo('42501'));
  await assert.rejects(app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3)',[gestor,'{}','Ensayo de permiso']),codigo('42501'));
  await assert.rejects(app.query("SELECT public.guardar_usuario_acceso($1,$2,'Intruso','administrador',true,0,NULL)",[gestor,'intruso-'+sufijo+'@slepb.gob.cl']),codigo('42501'));
 });
 const cg=await cookie(gestor),ce=await cookie(usuarios.encargado),cc=await cookie(usuarios.consulta_sede),ca=await cookie(usuarios.consulta);
 await caso('menú y portada homologados, sin módulos ajenos',async()=>{
  const h=await(await pedir('/',cg)).text(),r=await pedir('/insumos',cg),p=await r.text();assert.equal(r.status,200);assert.match(h,/Solicitudes de insumos/);assert.doesNotMatch(h,/href="\/inventario"|href="\/directorio"|href="\/mantenedores"/);assert.match(p,/accesos-modulo/);assert.match(p,/Catálogo de insumos/);assert.doesNotMatch(p,/Gestión institucional/);assert.match(p,/validar la solicitud/);
 });
 await caso('peticiones directas bloqueadas y denegación sin bucle',async()=>{
  for(const ruta of ['/inventario','/inventario/nivel-central','/inventario/p02','/inventario/celulares','/inventario/bodega-ti','/inventario/prestamos','/inventario/movimientos','/inventario/actas','/inventario/registro','/inventario/carga','/inventario/robos','/directorio','/mantenedores','/mantenedores/usuarios','/mantenedores/funcionarios','/mantenedores/sedes','/mantenedores/dependencias','/mantenedores/categorias','/documentacion/modelo-datos']){const r=await pedir(ruta,cg);assert.equal(r.status,307,ruta);assert.match(r.headers.get('location'),/sin-permiso/,ruta);}assert.equal((await pedir('/sin-permiso',cg)).status,200);
 });
 let producto,id,acta;
 await caso('compras, catálogo y fotos habilitados, consulta permanece sin escritura',async()=>{
  const datos={productoId:'',version:0,nombre:'Producto gestor '+sufijo,categoria:'Gestor ficticio '+sufijo,unidad:'unidad',cantidad:10,oc:'OC-GEST-'+sufijo,fechaCompra:fecha};
  producto=(await app.query('SELECT public.registrar_compra_insumo_acceso($1,$2::uuid,$3::jsonb) AS r',[gestor,randomUUID(),JSON.stringify(datos)])).rows[0].r.productoId;assert.equal((await pedir('/mantenedores/insumos',cg)).status,200);
  const foto=randomUUID(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64');await app.query('SELECT public.guardar_foto_insumo_acceso($1,$2,$3,$4)',[gestor,foto,'image/png',png]);await app.query('SELECT public.asignar_foto_insumo_acceso($1,$2,$3)',[gestor,producto,foto]);await assert.rejects(ingresar(usuarios.consulta,randomUUID(),producto,1),codigo('42501'));
 });
 await caso('creación y aislamiento de solicitudes; enlaces corresponden a permisos',async()=>{
  id=await nueva(sedes[0],[{producto_id:producto,cantidad:4}]);const propia=await(await pedir('/insumos/seguimiento?ver='+id,cc)).text();assert.match(propia,/Solicitante /);
  const ajena=await nueva(sedes[1],[{producto_id:producto,cantidad:1}],gestor);const h=await(await pedir('/insumos/seguimiento?ver='+ajena,cc)).text();assert.doesNotMatch(h,new RegExp('Solicitud '+ajena.slice(0,8)));assert.equal((await pedir('/insumos/solicitud',cc)).status,307);const nav=await(await pedir('/insumos',cc)).text();assert.doesNotMatch(nav,/href="\/insumos\/solicitud"/);assert.match(await(await pedir('/insumos',ca)).text(),/href="\/insumos\/seguimiento"/);
 });
 const ruta='/insumos/seguimiento?estado=activas&limite=100&ver='+id;
 await caso('validación por HTTP conserva filtros y registra al gestor',async()=>{
  await assert.rejects(aprobar(id,[aprobacion(producto,4)],gestor),codigo('P2602'));
  const f=formulario(await(await pedir(ruta+'&paso=validar',cg)).text(),'validacion-observacion');f.set('observacion','Revisión ficticia');const r=await post('/insumos/seguimiento',f,cg);assert.equal(r.status,303);assert.match(r.headers.get('location'),/limite=100/);assert.equal((await solicitud(id)).validado_por,gestor);
 });
 await caso('aprobación por HTTP reserva stock',async()=>{
  const f=formulario(await(await pedir(ruta+'&paso=aprobar',cg)).text(),'cant_aprobada_');f.set('cant_aprobada_'+producto,'4');const r=await post('/insumos/seguimiento',f,cg);assert.equal(r.status,303);assert.deepEqual(await stock(producto),{existencia:10,reservado:4});
 });
 await caso('entrega parcial por HTTP crea PDF y libera saldo de reserva',async()=>{
  const f=formulario(await(await pedir(ruta+'&paso=entregar',cg)).text(),'name="receptor"');for(const[k,v]of Object.entries({receptor:'Receptora ficticia',responsable_ti:'Gestor ficticio',recibeRun:'12345678-5',entregaRun:'12345678-5',recibeCargo:'Directora',entregaCargo:'Gestor de insumos',entregaCorreo:gestor,recibeCorreo:'persona@example.org',fecha_entrega:fecha}))f.set(k,v);f.set('cant_entregada_'+producto,'2');
  const r=await post('/insumos/seguimiento',f,cg);assert.equal(r.status,303);acta=/\/actas\/([a-f0-9-]{36})/.exec(r.headers.get('location'))?.[1];assert.ok(acta);assert.match(r.headers.get('location'),/volver=/);assert.deepEqual(await stock(producto),{existencia:8,reservado:0});assert.equal((await solicitud(id)).estado,'entregada');
  const original=(await db.query('SELECT pdf,actor FROM public.actas_documentos WHERE id=$1',[acta])).rows[0];assert.equal(original.actor,gestor);const pdf=Buffer.from(await(await pedir('/inventario/actas/'+acta+'/pdf',cg)).arrayBuffer());assert.equal(sha(pdf),sha(original.pdf));assert.equal((await pedir('/inventario/actas/'+acta,cg)).status,200);
 });
 await caso('impresión y correo con SMTP local o transporte deshabilitado',async()=>{
  const h=await(await pedir('/inventario/actas/'+acta+'?correo=si',cg)).text();assert.match(h,/Imprimir/);
  const f=formulario(h,'name="destinatarios"');f.set('destinatarios','persona@example.org');
  const r=await post('/inventario/actas/'+acta,f,cg);
  const envios=(await db.query('SELECT estado,actor FROM public.actas_envios WHERE acta_id=$1',[acta])).rows;
  if(process.env.ACTAS_TEST_MAIL_DIR){assert.equal(r.status,303);assert.equal(envios.length,1);assert.equal(envios[0].estado,'aceptado');assert.equal(envios[0].actor,gestor);}
  else{assert.equal(r.status,200);assert.match(h,/El envío de actas aún no está habilitado/);assert.match(h,/<fieldset disabled=/);assert.equal(envios.length,0,'Sin transporte no se inicia ningún envío');}
 });
 await caso('otras actas quedan inaccesibles por página, PDF, SQL y envío HTTP',async()=>{
  const otraActa=(await db.query('SELECT id FROM public.actas_documentos WHERE solicitud_insumo_id IS NULL AND pdf IS NOT NULL LIMIT 1')).rows[0];assert.ok(otraActa,'Fixture de acta de equipo');
  for(const suf of ['','/pdf','?correo=si'])assert.equal((await pedir('/inventario/actas/'+otraActa.id+suf,cg)).status,404);
  await assert.rejects(app.query('SELECT public.iniciar_envio_acta_acceso($1,$2,$3,$4::text[],$5,false)',[gestor,randomUUID(),otraActa.id,['persona@example.org'],'no-responder@slepb.gob.cl']),codigo('42501'));await assert.rejects(app.query('SELECT public.completar_pdf_acta_acceso($1,$2,$3)',[gestor,otraActa.id,Buffer.from('%PDF-'+'.'.repeat(100))]),codigo('42501'));
  const f=formulario(await(await pedir('/inventario/actas/'+acta+'?correo=si',cg)).text(),'name="destinatarios"');f.set('acta',otraActa.id);f.set('solicitud',randomUUID());f.set('destinatarios','persona@example.org');const antes=(await db.query('SELECT count(*)::int n FROM public.actas_envios')).rows[0].n;await post('/inventario/actas/'+otraActa.id,f,cg);assert.equal((await db.query('SELECT count(*)::int n FROM public.actas_envios')).rows[0].n,antes);assert.equal((await pedir('/inventario/actas/'+acta,ce)).status,307);
 });
 await caso('cancelar devuelve reservas y no genera una entrega',async()=>{
  const sid=await nueva(sedes[0],[{producto_id:producto,cantidad:1}]);await validar(sid,gestor);await aprobar(sid,[aprobacion(producto,1)],gestor);await cancelar(sid,gestor);assert.equal((await stock(producto)).reservado,0);
 });
 await caso('revocación de acceso y de operaciones en la siguiente petición',async()=>{
  await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=$1',[gestor]);assert.equal((await pedir('/insumos',cg)).status,307);await assert.rejects(ingresar(gestor,randomUUID(),producto,1),codigo('42501'));
 });
 console.log(`Gestor de insumos: ${pruebas} escenarios SQL/HTTP/PDF/SMTP aprobados: delegación, aislamiento, catálogo/compras, validación, aprobación, reservas, entrega parcial, actas/correo y revocación.`);
}finally{await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=ANY($1::text[])',[Object.values(usuarios)]);await app.end();await db.end();}
