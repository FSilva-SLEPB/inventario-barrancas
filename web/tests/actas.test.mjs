import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
async function cargar(n){if(cache.has(n))return cache.get(n);let m;if(n==='server-only')m=new vm.SyntheticModule([],()=>{});else if(!n.startsWith('@/')){const obj=require(n),v={...obj,default:obj.default??obj};m=new vm.SyntheticModule(Object.keys(v),function(){for(const[k,x]of Object.entries(v))this.setExport(k,x);});}else{const texto=await readFile(new URL('../src/'+n.slice(2)+'.ts',import.meta.url),'utf8'),js=ts.transpileModule(texto,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;m=new vm.SourceTextModule(js);cache.set(n,m);await m.link(cargar);return m;}cache.set(n,m);return m;}
const mod=await cargar('@/lib/validacion-actas');await mod.evaluate();const {metadatosActa,folioActa,validarCorreoActa,destinatariosActa}=mod.namespace;
const metadata={entregaNombre:'Persona ficticia',entregaRun:'12.345.678-5',entregaCargo:'',entregaCorreo:'',recibeRun:'12345678-5',recibeCargo:'',recibeCorreo:'persona@example.org',accesorios:'Cargador',observaciones:'Una línea\nOtra línea'};
test('folios desde cero, sin duplicación por tipo o año',()=>{assert.equal(folioActa(0),'ACT-000000');assert.equal(folioActa(12),'ACT-000012');assert.equal(folioActa(1000000),'ACT-1000000');for(const x of [-1,'x',Infinity])assert.throws(()=>folioActa(x));});
test('participantes y RUN se validan y las observaciones se conservan',()=>{assert.equal(metadatosActa(metadata).entregaRun,'12345678-5');for(const c of [{recibeRun:'12345678-9'},{entregaNombre:' '},{entregaCorreo:'Nombre <persona@example.org>'},{recibeCorreo:'x@example.org\r\nBcc:otra@example.org'},{observaciones:'x\u0000'}])assert.throws(()=>metadatosActa({...metadata,...c}));});
test('correo explícito, sin cabeceras y hasta cinco destinatarios distintos',()=>{assert.deepEqual([...destinatariosActa('UNO@example.org, dos@example.org')],['uno@example.org','dos@example.org']);for(const x of ['', 'x@example.org,x@example.org','x@example.org\nBcc:x@example.org','Nombre <x@example.org>','a@b','a@example.org,b@example.org,c@example.org,d@example.org,e@example.org,f@example.org'])assert.throws(()=>destinatariosActa(x));assert.equal(validarCorreoActa('Persona@EXAMPLE.ORG'),'persona@example.org');});
const pdfmod=await cargar('@/lib/pdf-actas');await pdfmod.evaluate();
test('PDF real usa fuente institucional y pagina textos extensos sin mutar datos',async()=>{
 process.chdir(new URL('..',import.meta.url).pathname);
 const d={schema:1,tipo:'asignacion',fecha:'2026-11-04',emitidoEn:'2026-11-04T12:00:00Z',movimientoId:'11111111-1111-4111-8111-111111111111',clase:'celular',origen:'Bodega TI',destino:'Sede ficticia',sedeNombre:'Sede ficticia',rbd:'PRUEBA',receptorNombre:'María Ñandú de Ejemplo',actor:'persona@example.org',bienes:[{telefono:'+56900000001',marca:'Marca ficticia',modelo:'Modelo',inventario:'DEMO',imei:'',condicionTecnica:'sin_verificar'}],metadata:{...metadata,observaciones:'Observación: devolución y asignación. '.repeat(45)},folio:0,version:1};
 const antes=JSON.stringify(d),pdf=await pdfmod.namespace.generarPdfActa(d);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>10000);assert.ok(pdf.toString('latin1').includes('/Subtype /Image'),'Logo institucional incrustado en el PDF');assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)??[]).length>=2);assert.equal(JSON.stringify(d),antes);
});
const correo=await cargar('@/lib/correo-actas');await correo.evaluate();
test('correo exige remitente institucional y configuración coherente',()=>{const f=correo.namespace.configuracionCorreoActas;assert.throws(()=>f({}));assert.throws(()=>f({ACTAS_SMTP_HOST:'servidor',ACTAS_CORREO_REMITENTE:'persona@example.org'}));assert.throws(()=>f({ACTAS_SMTP_HOST:'servidor',ACTAS_CORREO_REMITENTE:'no-responder@slepb.gob.cl',ACTAS_SMTP_USUARIO:'uno'}));const x=f({ACTAS_SMTP_HOST:'smtp.example.org',ACTAS_CORREO_REMITENTE:'no-responder@slepb.gob.cl',ACTAS_CORREO_PRUEBA_DESTINATARIOS:'persona@example.org'});assert.equal(x.port,587);assert.equal(x.secure,false);});

test('entrega histórica admite desconocidos sin aceptar RUN falso ni alterar requisitos de movimientos',()=>{const vacios=Object.fromEntries(Object.keys(metadata).map(k=>[k,'']));assert.equal(metadatosActa(vacios,true).entregaNombre,'');assert.throws(()=>metadatosActa(vacios));assert.throws(()=>metadatosActa({...vacios,recibeRun:'12345678-9'},true));});

test('contactos históricos aceptados se conservan sin habilitarlos como destinos SMTP',()=>{for(const correo of ["o'connor@example.org",'persona@ejemplo.cló']){const d={...metadata,recibeCorreo:correo};assert.equal(metadatosActa(d,true,correo).recibeCorreo,correo);assert.throws(()=>metadatosActa(d,true));assert.throws(()=>metadatosActa(d,true,'otra@example.org'));assert.throws(()=>destinatariosActa(correo));}});

const modelo=await cargar('@/lib/modelo-actas');await modelo.evaluate();
test('modelo institucional distingue NC, establecimientos, jardines, celulares y devolución',()=>{const f=modelo.namespace.tituloDocumentoActa,c=modelo.namespace.condicionesActa;const nc={tipo:'asignacion',clase:'equipo',sedeTipo:'nivel_central'};assert.ok(f(nc).includes('Nivel Central'));assert.ok(c(nc).some(t=>t.includes('3 días hábiles')));assert.ok(f({...nc,sedeTipo:'establecimiento'}).includes('Establecimiento educacional'));assert.ok(!c({...nc,sedeTipo:'establecimiento'}).some(t=>t.includes('3 días hábiles')));assert.ok(f({...nc,clase:'celular',sedeTipo:'jardin_infantil'}).includes('celulares'));assert.ok(c({...nc,tipo:'devolucion'})[0].includes('estado indicado'));assert.ok(c(nc).some(t=>t.includes('soporteti@slepb.gob.cl')&&t.includes('robos@slepb.gob.cl')));});
test('unidad y subdirección son opcionales compatibles con documentos previos, con límites y controles',()=>{assert.equal(metadatosActa(metadata).recibeUnidad,'');assert.equal(metadatosActa({...metadata,recibeUnidad:'Unidad TIC',recibeSubdireccion:'Planificación'}).recibeSubdireccion,'Planificación');assert.throws(()=>metadatosActa({...metadata,recibeUnidad:'x'.repeat(201)}));assert.throws(()=>metadatosActa({...metadata,recibeSubdireccion:'Una\nOtra'}));});

test('RUN desconocido queda vacío y uno informado debe ser válido',()=>{const r=metadatosActa({...metadata,entregaRun:'',recibeRun:''});assert.equal(r.entregaRun,'');assert.equal(r.recibeRun,'');assert.throws(()=>metadatosActa({...metadata,entregaRun:'12345678-9'}));});

test('correo de ensayo falla cerrado y solo acepta la lista autorizada',async()=>{
 const f=correo.namespace.configuracionCorreoActas,v=correo.namespace.validarDestinosCorreoActas,env={ACTAS_SMTP_HOST:'127.0.0.1',ACTAS_CORREO_REMITENTE:'no-responder@slepb.gob.cl'};
 assert.throws(()=>f(env));assert.throws(()=>f({...env,ACTAS_CORREO_MODO:'otro'}));assert.throws(()=>f({...env,ACTAS_CORREO_PRUEBA_DESTINATARIOS:'persona@example.org,persona@example.org'}));
 const c=f({...env,ACTAS_CORREO_PRUEBA_DESTINATARIOS:'Persona@example.org'});assert.equal(c.modo,'prueba');assert.throws(()=>v({...c,modo:undefined},['persona@example.org']));assert.deepEqual([...v(c,['PERSONA@example.org'])],['persona@example.org']);assert.throws(()=>v(c,['establecimiento@example.org']));assert.throws(()=>v(c,['persona@example.org','establecimiento@example.org']));
 await assert.rejects(correo.namespace.enviarPdfActa(c,'11111111-1111-4111-8111-111111111111',['establecimiento@example.org'],{},Buffer.from('no importa')),/Modo de prueba/);
 const prod=f({...env,ACTAS_CORREO_MODO:'produccion'});assert.equal(prod.modo,'produccion');assert.deepEqual([...v(prod,['destino@example.org'])],['destino@example.org']);
});

test('cambio conserva dos grupos de 100 bienes y pagina el PDF sin modificar el contenido',async()=>{
 process.chdir(new URL('..',import.meta.url).pathname);
 const bienes=prefijo=>Array.from({length:100},(_,n)=>({inventario:prefijo+'-'+String(n).padStart(3,'0'),categoriaNombre:'Equipo de prueba',marca:'Marca ficticia',modelo:'Modelo de prueba de paginación',serie:prefijo+'-SERIE-'+n,condicion_tecnica:'sin_verificar'}));
 const d={schema:5,tipo:'cambio',fecha:'2026-11-06',emitidoEn:'2026-11-06T12:00:00Z',movimientoId:null,operacionId:'11111111-1111-4111-8111-111111111111',clase:'equipo',origen:'Bodega TI',destino:'Sede ficticia',sedeNombre:'Sede ficticia',sedeTipo:'nivel_central',rbd:'',receptorNombre:'Persona ficticia',actor:'persona@example.org',bienes:bienes('REEMPLAZO'),bienesDevueltos:bienes('DEVUELTO'),detalleDevueltos:'Accesorios de los devueltos revisados',detalleEntregados:'Accesorios de los reemplazos registrados',metadata:{...metadata,entregaRun:'',recibeRun:''},folio:0,version:1};
 const antes=JSON.stringify(d),pdf=await pdfmod.namespace.generarPdfActa(d);assert.equal(JSON.stringify(d),antes);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g)??[]).length>=10);assert.ok(pdf.toString('latin1').includes('/Subtype /Image'));assert.match(modelo.namespace.tituloDocumentoActa(d),/cambio de equipamiento/);
 if(process.env.ACTAS_PDF_TEST_DIR){const {writeFile}=await import('node:fs/promises');await writeFile(process.env.ACTAS_PDF_TEST_DIR+'/cambio-100-100.pdf',pdf);}
});
