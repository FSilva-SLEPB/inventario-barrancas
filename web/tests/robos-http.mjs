// Solo datos sintéticos en la base temporal de CI.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID(),randomUUID(),randomUUID()],categoria=randomUUID(),equipos=[],incidentes=[];
const admin=`robo-admin-${sufijo}@slepb.gob.cl`,local=`robo-local-${sufijo}@slepb.gob.cl`,lector=`robo-lector-${sufijo}@slepb.gob.cl`,consulta=`robo-consulta-${sufijo}@slepb.gob.cl`;
const cookie=async email=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:email},maxAge:600});
const pedir=(ruta,c)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:c}});
const reporte=(sede,items)=>({sedeId:sede,fecha:'2026-10-20',lugar:'Lugar sensible ficticio '+sufijo,descripcion:'Antecedentes restringidos ficticios '+sufijo,enlace:'https://example.org/denuncia-ficticia',equipos:items});
const crear=async(actor,datos,id=randomUUID())=>{if(!incidentes.includes(id))incidentes.push(id);return(await app.query('SELECT public.reportar_robo_acceso($1,$2::uuid,$3::jsonb) AS resultado',[actor,id,JSON.stringify(datos)])).rows[0].resultado;};
const version=async id=>(await db.query('SELECT version FROM public.equipos WHERE id=$1',[id])).rows[0].version;
const item=async id=>({id,version:await version(id)});
const resolver=(actor,id,v,decision='validado')=>app.query('SELECT public.resolver_robo_acceso($1,$2::uuid,$3,$4,$5)',[actor,id,v,decision,'Revisión ficticia']);
const recuperar=(actor,id,v,equipo,fecha='2026-10-25')=>app.query('SELECT public.recuperar_equipo_robo_acceso($1,$2::uuid,$3,$4::uuid,$5::date,$6)',[actor,id,v,equipo,fecha,'Recuperación ficticia']);
const camposAccion=(html,clase)=>{const formulario=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(m=>m[0]).find(s=>s.includes(clase));assert.ok(formulario,'Formulario con acción: '+clase);const f=new FormData(),dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');for(const[m]of formulario.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(m)?.[1];if(n?.startsWith('$ACTION'))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(m)?.[1]??''));}assert.ok([...f.keys()].length);return f;};
const enviar=(ruta,c,f)=>fetch(origen+ruta,{method:'POST',redirect:'manual',headers:{Origin:new URL(origen).origin,Cookie:c},body:f});
let pruebas=0;await db.connect();await app.connect();
try{
 for(let i=0;i<4;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna) VALUES($1,$2,$3,$4,$5)',[sedes[i],i===2?'nivel_central':i===3?'jardin_infantil':'establecimiento','Sede robo '+i+' '+sufijo,i===2?null:'ROBO-'+i+'-'+sufijo,i===0?'Pudahuel':'Lo Prado']);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[categoria,'Categoría robo '+sufijo]);
 for(const[email,rol,sede]of [[admin,'administrador_gestion',null],[local,'encargado',sedes[0]],[lector,'consulta_sede',sedes[0]],[consulta,'consulta',null]])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',email,'Persona ficticia',rol,sede]);
 for(let i=0;i<6;i++){const id=(await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[admin,JSON.stringify({id:'',sedeId:sedes[i<2?0:i===2?1:i===5?3:2],categoriaId:categoria,marca:'Marca ficticia',modelo:'Modelo ficticio',serie:'ROBO-S-'+i+'-'+sufijo,inventario:'ROBO-I-'+i+'-'+sufijo,motivoIdentificacion:'',origen:i<3?'compra_sede':'compra_utic',condicionTecnica:'sin_verificar',compra:{},observaciones:''}),'Registro ficticio'])).rows[0].id;equipos.push(id);}
 await assert.rejects(crear(consulta,reporte(sedes[0],[await item(equipos[0])])),e=>e.code==='42501');
 await assert.rejects(crear(local,reporte(sedes[1],[await item(equipos[2])])),e=>e.code==='42501');pruebas+=2;
 // Dos equipos distintos y un grupo inválido no dejan escritura parcial ni historial.
 const antes=await version(equipos[0]);await assert.rejects(crear(admin,reporte(sedes[0],[await item(equipos[0]),await item(equipos[2])])),e=>e.code==='P2301');assert.equal(await version(equipos[0]),antes);assert.equal((await db.query('SELECT count(*) FROM public.incidentes_robos_equipos WHERE equipo_id=$1',[equipos[0]])).rows[0].count,'0');pruebas++;
 const datos=reporte(sedes[0],[await item(equipos[0]),await item(equipos[1])]),r=await crear(local,datos);assert.equal(r.repetida,false);assert.equal((await crear(local,datos,r.id)).repetida,true);pruebas++;
 await assert.rejects(crear(admin,reporte(sedes[0],[await item(equipos[0])])),e=>e.code==='P2302');await assert.rejects(resolver(local,r.id,1),e=>e.code==='42501');await assert.rejects(recuperar(local,r.id,1,equipos[0]),e=>e.code==='42501');pruebas+=3;
 const ca=await cookie(admin),cl=await cookie(local),cc=await cookie(consulta),cle=await cookie(lector);
 const privado=await(await pedir('/inventario/robos/'+r.id,cl)).text();assert.ok(privado.includes(datos.lugar));assert.equal((await pedir('/inventario/robos/'+r.id,cc)).headers.get('location'),'/sin-permiso');assert.equal((await pedir('/inventario/robos/reportar',cle)).headers.get('location'),'/sin-permiso');pruebas++;
 // La revisión usa la Server Action real y un perfil local no puede reutilizarla.
 const html=await(await pedir('/inventario/robos/'+r.id,ca)).text();
 const f=camposAccion(html,'formulario-catalogos');for(const[k,v]of Object.entries({id:r.id,version:'1',operacion:'validado',motivo:'Validación HTTP ficticia'}))f.set(k,v);
 await enviar('/inventario/robos/'+r.id,cl,f);assert.equal((await db.query('SELECT estado FROM public.incidentes_robos WHERE id=$1',[r.id])).rows[0].estado,'reportado');pruebas++;
 const decision=await enviar('/inventario/robos/'+r.id,ca,f);assert.ok([200,303].includes(decision.status));assert.equal((await db.query('SELECT estado FROM public.incidentes_robos WHERE id=$1',[r.id])).rows[0].estado,'validado');pruebas++;
 await assert.rejects(resolver(admin,r.id,1),e=>e.code==='P2301');await assert.rejects(recuperar(admin,r.id,2,equipos[0],'2026-10-19'),e=>e.code==='22023');pruebas+=2;
 await recuperar(admin,r.id,2,equipos[0]);const parcial=(await db.query('SELECT recuperado_fecha FROM public.incidentes_robos_equipos WHERE incidente_id=$1',[r.id])).rows;assert.equal(parcial.filter(e=>e.recuperado_fecha).length,1);pruebas++;
 // Rechazo deja el equipo disponible para un reporte nuevo; conservar la historia.
 const rechazado=await crear(admin,reporte(sedes[1],[await item(equipos[2])]));await resolver(admin,rechazado.id,1,'rechazado');const nuevo=await crear(admin,reporte(sedes[1],[await item(equipos[2])]));assert.notEqual(nuevo.id,rechazado.id);pruebas++;
 const nc=await crear(admin,reporte(sedes[2],[await item(equipos[3])]));await resolver(admin,nc.id,1);pruebas++;
 // Consolidado en consulta no entrega el lugar ni los documentos restringidos, separa NC y aplica sede.
 const general=await(await pedir('/inventario/robos?q='+sufijo,cc)).text();assert.ok(general.includes('ROBO-I-0-'+sufijo));assert.ok(general.includes('ROBO-I-3-'+sufijo));assert.ok(!general.includes(datos.lugar)&&!general.includes(datos.descripcion)&&!general.includes(datos.enlace));pruebas++;
 const central=await(await pedir('/inventario/robos?ambito=nc&q='+sufijo,cc)).text();assert.ok(central.includes('ROBO-I-3-'+sufijo));assert.ok(!central.includes('ROBO-I-1-'+sufijo));pruebas++;
 const soloLocal=await(await pedir('/inventario/robos?sede='+sedes[1]+'&q='+sufijo,cle)).text();assert.ok(!soloLocal.includes('ROBO-I-2-'+sufijo));
 assert.equal((await pedir('/inventario/robos/'+nc.id,cl)).status,404);pruebas++;
 const recuperados=await(await pedir('/inventario/robos?estado=recuperado&q='+sufijo,cc)).text();assert.ok(recuperados.includes('ROBO-I-0-'+sufijo));assert.ok(!recuperados.includes('ROBO-I-1-'+sufijo));pruebas++;
 const comuna=await(await pedir('/inventario/robos?comuna=Pudahuel&desde=2026-10-20&hasta=2026-10-20&q='+sufijo,cc)).text();assert.ok(comuna.includes('ROBO-I-1-'+sufijo));assert.ok(!comuna.includes('ROBO-I-3-'+sufijo));pruebas++;
 const ficha=await(await pedir('/inventario/'+equipos[1],ca)).text();assert.ok(ficha.includes('Incidentes de robo'));assert.ok(ficha.includes('Robo validado'));assert.ok(ficha.includes('/inventario/robos/'+r.id));assert.ok(ficha.includes('Validación HTTP ficticia'));const fichaConsulta=await(await pedir('/inventario/'+equipos[1],cc)).text();assert.ok(!fichaConsulta.includes('Validación HTTP ficticia'));
 const pertenencia=await db.query('SELECT sede_id,situacion,condicion_tecnica FROM public.equipos WHERE id=$1',[equipos[1]]);assert.equal(pertenencia.rows[0].sede_id,sedes[0]);assert.equal(pertenencia.rows[0].situacion,'recibido');assert.equal(pertenencia.rows[0].condicion_tecnica,'sin_verificar');pruebas++;
 await assert.rejects(app.query("UPDATE public.incidentes_robos SET estado='validado'"),e=>e.code==='42501');assert.equal((await db.query('SELECT count(*) FROM public.equipos_historial WHERE equipo_id=$1 AND incidente_id=$2',[equipos[0],r.id])).rows[0].count,'3');pruebas++;
 // Reportar desde el formulario HTTP conserva los identificadores seleccionados.
 const formulario=await(await pedir('/inventario/robos/reportar?sede='+sedes[2],ca)).text(),fReporte=camposAccion(formulario,'formulario-reporte-robo'),idHTTP=randomUUID();incidentes.push(idHTTP);
 for(const[k,v]of Object.entries({solicitud:idHTTP,sedeId:sedes[2],fecha:'2026-10-20',lugar:'Reporte HTTP ficticio',descripcion:'Incidente creado desde la acción real',enlace:''}))fReporte.set(k,v);
 fReporte.append('equipo',JSON.stringify(await item(equipos[4])));const publicado=await enviar('/inventario/robos/reportar?sede='+sedes[2],ca,fReporte);assert.ok([200,303].includes(publicado.status));assert.equal((await db.query('SELECT count(*) FROM public.incidentes_robos WHERE id=$1',[idHTTP])).rows[0].count,'1');pruebas++;
 // El incidente abierto bloquea también la entrega de un equipo pendiente.
 const bodega=await crear(admin,reporte(sedes[3],[await item(equipos[5])]));
 await assert.rejects(app.query('SELECT public.regularizar_entregas_acceso($1,$2::uuid,$3::jsonb)',[admin,randomUUID(),JSON.stringify([{sedeId:sedes[3],equipos:[await item(equipos[5])],receptora:'Directora ficticia',fecha:'2026-10-26',enlaceActa:''}])]),e=>e.code==='P2302');
 assert.equal((await db.query('SELECT situacion FROM public.equipos WHERE id=$1',[equipos[5]])).rows[0].situacion,'pendiente_entrega');
 assert.equal((await db.query('SELECT count(*) FROM public.entregas_equipos WHERE sede_id=$1',[sedes[3]])).rows[0].count,'0');pruebas++;
 await assert.rejects(recuperar(admin,r.id,3,equipos[2]),e=>e.code==='P2301');
 await resolver(admin,bodega.id,1,'rechazado');pruebas++;
 // Dashboard retirado: sin enlaces, gráficos ni exportación; conserva el consolidado.
 const query='?desde=2026-01-01&hasta=2026-11-02&q='+sufijo;
 const consolidado=await(await pedir('/inventario/robos'+query,cc)).text();assert.ok(!consolidado.includes('/inventario/robos/dashboard'));assert.ok(consolidado.includes('Consolidado de robos'));pruebas++;
 for(const ruta of ['/inventario/robos/dashboard','/inventario/robos/dashboard/exportar']){const r=await pedir(ruta+query,cc);assert.equal(r.status,307);const u=new URL(r.headers.get('location'),origen);assert.equal(u.pathname,'/inventario/robos');assert.equal(u.searchParams.get('q'),sufijo);assert.notEqual(r.headers.get('content-type'),'text/csv; charset=utf-8');pruebas++;}
 await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,false,1,$5::uuid)',['felipe.silva@slepb.gob.cl',local,'Persona ficticia','encargado',sedes[0]]);const revocado=await pedir('/inventario/robos/dashboard/exportar'+query,cl);assert.equal(revocado.headers.get('location'),'/acceso-denegado');pruebas++;
 console.log(`${pruebas} comprobaciones de robos: permisos, HTTP, atomicidad, reintentos, versiones, recuperación parcial, filtros, sede, privacidad e historial.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);await db.query('DELETE FROM public.incidentes_robos_historial WHERE incidente_id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.incidentes_robos_equipos WHERE incidente_id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.incidentes_robos WHERE id=ANY($1::uuid[])',[incidentes]);await db.query('DELETE FROM public.equipos WHERE id=ANY($1::uuid[])',[equipos]);
 const correos=[admin,local,lector,consulta];await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[correos]);await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[categoria]);await Promise.all([app.end(),db.end()]);
}
