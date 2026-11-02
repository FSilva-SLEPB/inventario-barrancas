// Solo datos ficticios en PostgreSQL temporal de CI.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt');
const origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const sufijo=randomUUID(),sedes=[randomUUID(),randomUUID(),randomUUID(),randomUUID()],cat=randomUUID();
const correos={gestion:`entrega-gestion-${sufijo}@slepb.gob.cl`,consulta:`entrega-consulta-${sufijo}@slepb.gob.cl`,encargado:`entrega-local-${sufijo}@slepb.gob.cl`};
const equipos=[];let pruebas=0;
const cookie=async correo=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:correo},maxAge:600});
const pedir=(ruta,sesion)=>fetch(origen+ruta,{headers:{Cookie:sesion},redirect:'manual'});
const enviar=(actor,solicitud,grupos,cliente=app)=>cliente.query('SELECT public.regularizar_entregas_acceso($1,$2::uuid,$3::jsonb) AS resultado',[actor,solicitud,JSON.stringify(grupos)]);
async function crear(sede){const d={id:'',sedeId:sede,categoriaId:cat,marca:'Marca ficticia',modelo:'ENTREGA-'+sufijo,serie:'S-'+randomUUID(),inventario:'I-'+randomUUID(),motivoIdentificacion:'',origen:'compra_utic',condicionTecnica:'sin_verificar',compra:{},observaciones:''};const {rows}=await app.query('SELECT public.guardar_equipo_acceso($1,$2::jsonb,0,$3) AS id',[correos.gestion,JSON.stringify(d),'Registro ficticio']);equipos.push(rows[0].id);return rows[0].id;}
const grupo=(sede,items,fecha='2026-10-26')=>({sedeId:sede,equipos:items.map(id=>({id,version:1})),fecha,receptora:'Directora ficticia '+sufijo,enlaceActa:''});
const leer=async id=>(await db.query('SELECT *,fecha_entrega::text AS fecha_formato FROM public.equipos WHERE id=$1',[id])).rows[0];
async function falla(actor,grupos,codigo){await assert.rejects(enviar(actor,randomUUID(),grupos),e=>e.code===codigo);pruebas++;}
const dec=s=>s.replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');
function ocultos(html){const f=new FormData();for(const[input]of html.matchAll(/<input\b[^>]*>/g)){const n=/\bname="([^"]+)"/.exec(input)?.[1];if(input.includes('type="hidden"')&&(n?.startsWith('$ACTION')||n==='solicitud'))f.append(dec(n),dec(/\bvalue="([^"]*)"/.exec(input)?.[1]??''));}assert.ok([...f.keys()].some(k=>k.startsWith('$ACTION')));return f;}
await db.connect();await app.connect();
try{
 for(let i=0;i<4;i++)await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,comuna) VALUES($1,$2,$3,$4,$5)',[sedes[i],i===3?'establecimiento':'jardin_infantil',`Jardín ficticio ${i} ${sufijo}`,'ENT-'+i+'-'+sufijo,['Pudahuel','Lo Prado','Cerro Navia','Pudahuel'][i]]);
 await db.query('INSERT INTO public.categorias_bienes(id,nombre) VALUES($1,$2)',[cat,'Categoría entrega '+sufijo]);
 for(const[k,rol]of Object.entries({gestion:'administrador_gestion',consulta:'consulta',encargado:'encargado'}))await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5::uuid)',['felipe.silva@slepb.gob.cl',correos[k],'Persona ficticia',rol,k==='encargado'?sedes[0]:null]);
 const ids=[await crear(sedes[0]),await crear(sedes[0]),await crear(sedes[1]),await crear(sedes[2])];
 const grupos=[grupo(sedes[0],ids.slice(0,2)),grupo(sedes[1],[ids[2]],'2026-10-27'),grupo(sedes[2],[ids[3]],'2026-10-28')];
 await falla(correos.consulta,grupos,'42501');await falla(correos.encargado,grupos,'42501');
 const invalido=structuredClone(grupos);invalido[1].equipos[0].version=999;
 const fallido=randomUUID();await assert.rejects(enviar(correos.gestion,fallido,invalido),e=>e.code==='P2102');
 assert.equal((await leer(ids[0])).situacion,'pendiente_entrega');assert.equal((await leer(ids[0])).version,1);
 assert.equal((await db.query('SELECT count(*) FROM public.entregas_lotes WHERE id=$1',[fallido])).rows[0].count,'0');pruebas++;
 await falla(correos.gestion,[{...grupos[0],equipos:[...grupos[0].equipos,grupos[0].equipos[0]]}],'22023');
 await falla(correos.gestion,[{...grupos[0],receptora:''}],'22023');await falla(correos.gestion,[{...grupos[0],fecha:'2099-01-01'}],'22023');
 const ee=await crear(sedes[3]);await falla(correos.gestion,[grupo(sedes[3],[ee])],'P2101');
 const gestion=await cookie(correos.gestion),consulta=await cookie(correos.consulta),local=await cookie(correos.encargado);
 for(const sesion of [consulta,local])for(const ruta of ['/inventario/movimientos','/inventario/movimientos/regularizar?equipo='+ids[0],'/inventario/movimientos/entregas/'+randomUUID()]){assert.equal((await pedir(ruta,sesion)).headers.get('location'),'/sin-permiso');pruebas++;}
 const previa=await(await pedir('/inventario/movimientos/regularizar?equipo='+ids[0],gestion)).text();assert.ok(previa.includes('Directora del jardín infantil'));assert.ok(previa.includes('value="2026-10-26"'));pruebas++;
 const todos=await(await pedir('/inventario/movimientos/regularizar?todos=si&tipo=jardin_infantil&sede='+sedes[0]+'&q=ENTREGA-'+sufijo,gestion)).text();
 assert.ok(todos.includes('Jardín ficticio 0 '+sufijo));assert.ok(!todos.includes('Jardín ficticio 1 '+sufijo));assert.ok(todos.includes('2 equipos'));pruebas++;
 const solicitud=randomUUID();const resultado=(await enviar(correos.gestion,solicitud,grupos)).rows[0].resultado;assert.equal(resultado.cantidad,4);
 for(const g of grupos)for(const e of g.equipos){const fila=await leer(e.id);assert.equal(fila.situacion,'recibido');assert.equal(fila.version,2);assert.equal(fila.fecha_formato,g.fecha);assert.equal(fila.condicion_tecnica,'sin_verificar');}
 assert.equal((await db.query('SELECT count(*) FROM public.entregas_equipos WHERE lote_id=$1',[solicitud])).rows[0].count,'3');pruebas++;
 assert.equal((await enviar(correos.gestion,solicitud,grupos)).rows[0].resultado.repetida,true);
 await assert.rejects(enviar(correos.gestion,solicitud,[{...grupos[0],receptora:'Otra directora ficticia'}]),e=>e.code==='P2103');
 await falla(correos.gestion,grupos,'P2102');
 const historia=(await db.query('SELECT antes,despues,entrega_id,actor FROM public.equipos_historial WHERE equipo_id=$1 AND entrega_id IS NOT NULL',[ids[0]])).rows;
 assert.equal(historia.length,1);assert.equal(historia[0].antes.situacion,'pendiente_entrega');assert.equal(historia[0].despues.situacion,'recibido');assert.equal(historia[0].actor,correos.gestion);pruebas++;
 const detalle=await(await pedir('/inventario/movimientos/entregas/'+historia[0].entrega_id,gestion)).text();assert.ok(detalle.includes(grupos[0].receptora));assert.ok(detalle.includes('Sin folio informado'));pruebas++;
 await assert.rejects(app.query('UPDATE public.entregas_equipos SET receptor_nombre=$1',['Alteración ficticia']),e=>e.code==='42501');pruebas++;
 // Confirmación mediante la acción de la página Next.js real y posterior reintento.
 const quinto=await crear(sedes[0]);const html=await(await pedir('/inventario/movimientos/regularizar?equipo='+quinto,gestion)).text();
 const f=ocultos(html);f.set('seleccion',JSON.stringify([{sedeId:sedes[0],equipos:[{id:quinto,version:1}]}]));f.set('confirmo','si');f.set('fecha-'+sedes[0],'2026-10-26');f.set('receptora-'+sedes[0],'Directora HTTP ficticia');f.set('acta-'+sedes[0],'');
 const post=sesion=>fetch(origen+'/inventario/movimientos/regularizar?equipo='+quinto,{method:'POST',redirect:'manual',headers:{Origin:new URL(origen).origin,Cookie:sesion},body:f});
 assert.equal(new URL((await post(consulta)).headers.get('location'),origen).pathname,'/sin-permiso');
 const respuesta=await post(gestion);assert.equal(respuesta.status,303);assert.equal(new URL(respuesta.headers.get('location'),origen).pathname,'/inventario/movimientos');
 assert.equal((await leer(quinto)).situacion,'recibido');assert.equal((await post(gestion)).status,303);pruebas++;
 const resumen=await(await pedir(respuesta.headers.get('location'),gestion)).text();assert.ok(resumen.includes('Regularización registrada'));pruebas++;
 // Dos confirmaciones concurrentes de la misma solicitud no duplican entregas.
 const sexto=await crear(sedes[1]);const op=randomUUID(),data=[grupo(sedes[1],[sexto],'2026-10-27')];
 const clientes=[new pg.Client({connectionString:process.env.DATABASE_URL}),new pg.Client({connectionString:process.env.DATABASE_URL})];
 try{await Promise.all(clientes.map(c=>c.connect()));const r=await Promise.all(clientes.map(c=>enviar(correos.gestion,op,data,c)));assert.equal(r.filter(x=>x.rows[0].resultado.repetida).length,1);assert.equal((await leer(sexto)).version,2);pruebas++;}finally{await Promise.all(clientes.map(c=>c.end()));}
 console.log(`${pruebas} comprobaciones de entregas: selección, fechas, directora, atomicidad, versiones, permisos, idempotencia, acción HTTP y concurrencia.`);
}finally{
 await db.query('DELETE FROM public.equipos_historial WHERE equipo_id=ANY($1::uuid[])',[equipos]);
 await db.query('DELETE FROM public.entregas_detalle WHERE equipo_id=ANY($1::uuid[])',[equipos]);
 await db.query('DELETE FROM public.entregas_equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);
 await db.query('DELETE FROM public.entregas_lotes WHERE actor=$1',[correos.gestion]);
 await db.query('DELETE FROM public.equipos WHERE sede_id=ANY($1::uuid[])',[sedes]);
 await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[Object.values(correos)]);
 await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[Object.values(correos)]);
 await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[sedes]);await db.query('DELETE FROM public.categorias_bienes WHERE id=$1',[cat]);
 await Promise.all([app.end(),db.end()]);
}
