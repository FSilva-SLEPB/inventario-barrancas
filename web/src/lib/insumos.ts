import 'server-only';
import {randomUUID} from 'node:crypto';
import {exigirAcceso,exigirGestionInsumos} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {requiereSede,puedeSolicitarInsumos} from '@/lib/politica-acceso';
import {esIdSede} from '@/lib/validacion-sedes';
import {generarPdfActa} from '@/lib/pdf-actas';
import type {DatosActa} from '@/lib/validacion-actas';
export type InsumoCatalogo={id:string;codigo:string;nombre:string;categoria:string;unidad:string;activo:boolean;foto_url:string|null;version:number};
export type InsumoStock={producto_id:string;existencia:number;reservado:number;disponible:number;nombre:string;codigo:string;unidad:string;categoria:string;activo:boolean;foto_url:string|null};
export type SolicitudInsumo={id:string;sede_id:string;sede_nombre:string;sede_rbd:string|null;solicitante_correo:string;solicitante_nombre:string;solicitante_run:string;solicitante_cargo:string;solicitante_telefono:string;modalidad_entrega:string;estado:'solicitada'|'en_validacion'|'aprobada'|'entregada'|'cancelada';motivo:string;solicitado_en:string;validado_en:string|null;validado_por:string|null;observacion_validacion:string;aprobado_en:string|null;aprobado_por:string|null;entregado_en:string|null;cancelado_en:string|null;cancelado_por:string|null;cancelado_motivo:string|null;acta_id:string|null;lineas:SolicitudLinea[];};
export type SolicitudLinea={id:string;producto_id:string;codigo:string;nombre:string;categoria:string;unidad:string;foto_url:string|null;cantidad_solicitada:number;cantidad_aprobada:number;cantidad_entregada:number;motivo_reduccion:string;};
export type FiltrosSolicitudes={estado?:string;sede?:string;q?:string;pagina:number;limite:number;};
export async function listarCatalogoInsumos(activosSolo=true){
 await exigirAcceso('insumos');
 const db=obtenerBaseDatos();
 const {rows}=await db.query<InsumoCatalogo>(`
  SELECT id,codigo,nombre,categoria,unidad,activo,foto_url,version FROM public.catalogo_insumos
  ${activosSolo?'WHERE activo':' ORDER BY codigo'}
  ${activosSolo?'ORDER BY codigo':''}`);
 return rows;
}
export async function listarStockInsumos(){
 await exigirGestionInsumos();
 const db=obtenerBaseDatos();
 const {rows}=await db.query<InsumoStock>(`
  SELECT s.producto_id,s.existencia,s.reservado,(s.existencia-s.reservado) AS disponible,
         c.codigo,c.nombre,c.categoria,c.unidad,c.activo,c.foto_url
  FROM public.stock_insumos s
  JOIN public.catalogo_insumos c ON c.id=s.producto_id
  ORDER BY c.codigo`);
 return rows;
}
export async function listarSolicitudesInsumos(f:FiltrosSolicitudes){
 const actor=await exigirAcceso('insumos');
 const db=obtenerBaseDatos();
 const where=[] as string[];const params:unknown[]=[];let i=1;
 if(requiereSede(actor.rol)){where.push(`si.sede_id = $${i++}::uuid`);params.push(actor.sedeId);}
 if(f.estado==='activas'){where.push(`si.estado IN ('solicitada','en_validacion','aprobada')`);}
 else if(f.estado==='finalizadas'){where.push(`si.estado IN ('entregada','cancelada')`);}
 else if(f.estado){where.push(`si.estado = $${i++}`);params.push(f.estado);}
 if(f.sede){where.push(`si.sede_id = $${i++}`);params.push(f.sede);}
 if(f.q){where.push(`(si.solicitante_correo ILIKE $${i} OR sd.nombre ILIKE $${i} OR COALESCE(si.solicitante_nombre,'') ILIKE $${i})`);params.push(`%${f.q}%`);i++;}
 const whereSql=where.length?`WHERE ${where.join(' AND ')}`:'';
 const total=Number((await db.query<{n:string}>(`SELECT count(*) AS n FROM public.solicitudes_insumos si JOIN public.sedes sd ON sd.id=si.sede_id ${whereSql}`,params)).rows[0].n);
 const paginas=Math.max(1,Math.ceil(total/f.limite));const pagina=Math.min(f.pagina,paginas);
 params.push(f.limite,(pagina-1)*f.limite);
 const {rows}=await db.query<SolicitudInsumo & {lineas_json:string}>(`
  SELECT si.id,si.sede_id,sd.nombre AS sede_nombre,sd.rbd AS sede_rbd,si.solicitante_correo,
   COALESCE(si.solicitante_nombre,'') AS solicitante_nombre, COALESCE(si.solicitante_run,'') AS solicitante_run,
   COALESCE(si.solicitante_cargo,'') AS solicitante_cargo, COALESCE(si.solicitante_telefono,'') AS solicitante_telefono,
   COALESCE(si.modalidad_entrega,'') AS modalidad_entrega,
   si.estado,COALESCE(si.motivo,'') AS motivo,
   si.solicitado_en::text AS solicitado_en,si.validado_en::text AS validado_en,si.validado_por,COALESCE(si.observacion_validacion,'') AS observacion_validacion,
   si.aprobado_en::text AS aprobado_en,si.aprobado_por,
   si.entregado_en::text AS entregado_en,si.cancelado_en::text AS cancelado_en,si.cancelado_por,
   si.cancelado_motivo,si.acta_id,
   COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
     'id',d.id,'producto_id',d.producto_id,'codigo',c.codigo,'nombre',c.nombre,'categoria',c.categoria,
     'unidad',c.unidad,'foto_url',c.foto_url,'cantidad_solicitada',d.cantidad_solicitada,'cantidad_aprobada',d.cantidad_aprobada,
     'cantidad_entregada',d.cantidad_entregada,'motivo_reduccion',d.motivo_reduccion
    ) ORDER BY c.codigo)
    FROM public.solicitudes_insumos_detalle d
    JOIN public.catalogo_insumos c ON c.id=d.producto_id
    WHERE d.solicitud_id=si.id),'[]'::jsonb) AS lineas_json
  FROM public.solicitudes_insumos si
  JOIN public.sedes sd ON sd.id=si.sede_id
  ${whereSql}
  ORDER BY si.solicitado_en DESC,si.id DESC
  LIMIT $${i++} OFFSET $${i++}`,params);
 return {filas:rows.map(r=>({...r,lineas:typeof r.lineas_json==='string'?JSON.parse(r.lineas_json):r.lineas_json,lineas_json:undefined})),total,pagina,paginas};
}
export async function obtenerSolicitudInsumo(id:string){
 const actor=await exigirAcceso('insumos');
 if(!esIdSede(id))return null;
 const db=obtenerBaseDatos();
 const {rows}=await db.query<SolicitudInsumo & {lineas_json:string}>(`
  SELECT si.id,si.sede_id,sd.nombre AS sede_nombre,sd.rbd AS sede_rbd,si.solicitante_correo,
   COALESCE(si.solicitante_nombre,'') AS solicitante_nombre, COALESCE(si.solicitante_run,'') AS solicitante_run,
   COALESCE(si.solicitante_cargo,'') AS solicitante_cargo, COALESCE(si.solicitante_telefono,'') AS solicitante_telefono,
   COALESCE(si.modalidad_entrega,'') AS modalidad_entrega,
   si.estado,COALESCE(si.motivo,'') AS motivo,
   si.solicitado_en::text AS solicitado_en,si.validado_en::text AS validado_en,si.validado_por,COALESCE(si.observacion_validacion,'') AS observacion_validacion,
   si.aprobado_en::text AS aprobado_en,si.aprobado_por,
   si.entregado_en::text AS entregado_en,si.cancelado_en::text AS cancelado_en,si.cancelado_por,
   si.cancelado_motivo,si.acta_id,
   COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
     'id',d.id,'producto_id',d.producto_id,'codigo',c.codigo,'nombre',c.nombre,'categoria',c.categoria,
     'unidad',c.unidad,'foto_url',c.foto_url,'cantidad_solicitada',d.cantidad_solicitada,'cantidad_aprobada',d.cantidad_aprobada,
     'cantidad_entregada',d.cantidad_entregada,'motivo_reduccion',d.motivo_reduccion
    ) ORDER BY c.codigo)
    FROM public.solicitudes_insumos_detalle d
    JOIN public.catalogo_insumos c ON c.id=d.producto_id
    WHERE d.solicitud_id=si.id),'[]'::jsonb) AS lineas_json
  FROM public.solicitudes_insumos si
  JOIN public.sedes sd ON sd.id=si.sede_id
  WHERE si.id=$1::uuid AND ($2::boolean OR si.sede_id=$3::uuid)`,[id,!requiereSede(actor.rol),actor.sedeId]);
 if(!rows[0])return null;
 const r=rows[0];
 return {...r,lineas:typeof r.lineas_json==='string'?JSON.parse(r.lineas_json):r.lineas_json,lineas_json:undefined};
}
export async function crearSolicitudInsumo(sedeId:string,solicitanteCorreo:string,lineas:{producto_id:string;cantidad:number}[],datos?:{nombre?:string;run?:string;cargo?:string;telefono?:string;modalidad?:string;motivo?:string}){
 const actor=await exigirAcceso('insumos');
 if(!puedeSolicitarInsumos(actor.rol)||actor.email!==solicitanteCorreo||requiereSede(actor.rol)&&actor.sedeId!==sedeId)throw new Error('No tienes permiso para crear esta solicitud.');
 const db=obtenerBaseDatos();
 const r=await db.query<{id:string}>(`SELECT public.crear_solicitud_insumos($1,$2::uuid,$3::jsonb,$4::jsonb) AS id`,[solicitanteCorreo,sedeId,JSON.stringify(lineas),JSON.stringify(datos||{})]);
 return r.rows[0].id;
}
export async function validarSolicitudInsumo(actor:string,solicitud:string,observacion:string){
 const autenticado=await exigirGestionInsumos();
 if(actor!==autenticado.email)throw new Error('Actor inválido.');
 const db=obtenerBaseDatos();
 const r=await db.query<{r:JSON}>(`SELECT public.validar_solicitud_insumos($1,$2,$3) AS r`,[actor,solicitud,observacion||'']);
 return r.rows[0].r;
}
export async function aprobarSolicitudInsumo(actor:string,solicitud:string,datos:{lineas:{producto_id:string;cantidad_aprobada:number;motivo_reduccion:string}[];motivo:string}){
 const autenticado=await exigirGestionInsumos();
 if(actor!==autenticado.email)throw new Error('Actor inválido.');
 const db=obtenerBaseDatos();
 const r=await db.query<{r:JSON}>(`SELECT public.aprobar_solicitud_insumos($1,$2,$3::jsonb) AS r`,[actor,solicitud,JSON.stringify(datos)]);
 return r.rows[0].r;
}
export async function entregarSolicitudInsumo(actor:string,solicitud:string,datos:{receptor:string;responsable_ti:string;fecha_entrega:string;observaciones:string;lineas:{producto_id:string;cantidad_entregada:number}[];acta_id?:string|null}){
 const autenticado=await exigirGestionInsumos();
 if(actor!==autenticado.email)throw new Error('Actor inválido.');
 const db=obtenerBaseDatos();
 const r=await db.query<{r:JSON}>(`SELECT public.entregar_solicitud_insumos($1,$2,$3::jsonb) AS r`,[actor,solicitud,JSON.stringify(datos)]);
 return r.rows[0].r;
}

export async function entregarSolicitudInsumoConActa(solicitud:string,datos:{receptor:string;responsable_ti:string;fecha_entrega:string;observaciones:string;recibeRun?:string;recibeCargo?:string;recibeCorreo?:string;entregaRun?:string;entregaCargo?:string;entregaCorreo?:string;lineas:{producto_id:string;cantidad_entregada:number}[]}){
 const actor=await exigirGestionInsumos();
 if(!esIdSede(solicitud)) throw new Error('Solicitud inválida.');
 const pool=obtenerBaseDatos();
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  const entrega=(await db.query<{r:{entrega_id:string}}>('SELECT public.entregar_solicitud_insumos($1,$2::uuid,$3::jsonb) AS r',[actor.email,solicitud,JSON.stringify(datos)])).rows[0].r;
  const actual=(await db.query<{acta_id:string|null}>('SELECT acta_id FROM public.solicitudes_insumos WHERE id=$1::uuid',[solicitud])).rows[0];
  if(!actual)throw new Error('Solicitud no disponible.');
  const actaId=actual.acta_id??solicitud;
  const metadata={
   entregaNombre: datos.responsable_ti || actor.email,
   entregaRun: datos.entregaRun || '',
   entregaCargo: datos.entregaCargo || 'Unidad TIC',
   entregaCorreo: datos.entregaCorreo || actor.email,
   recibeRun: datos.recibeRun || '',
   recibeCargo: datos.recibeCargo || '',
   recibeCorreo: datos.recibeCorreo || '',
   recibeUnidad: '',
   recibeSubdireccion: '',
   accesorios: '',
   observaciones: datos.observaciones || '',
   fechaEntrega: datos.fecha_entrega,
   recibeNombre: datos.receptor,
  };
  const prep=(await db.query<{r:{id:string;datos:DatosActa;completa:boolean}}>(
    `SELECT public.preparar_acta_insumo_acceso($1,$2::uuid,$3::uuid,$4::jsonb,$5::jsonb) AS r`,
    [actor.email, actaId, solicitud, JSON.stringify(metadata), JSON.stringify(datos.lineas)]
  )).rows[0].r;
  if(!prep.completa){
   const pdf=await generarPdfActa(prep.datos);
   await db.query(`SELECT public.completar_pdf_acta_acceso($1,$2::uuid,$3::bytea)`,[actor.email,prep.id,pdf]);
  }
  await db.query('SELECT public.vincular_acta_entrega_insumo_acceso($1,$2::uuid,$3::uuid)',[actor.email,prep.id,entrega.entrega_id]);
  await db.query('COMMIT');
  return {entrega, actaId: prep.id};
 }catch(e){ try{ await db.query('ROLLBACK'); }catch{} throw e; }
 finally{ db.release(); }
}
export async function cancelarSolicitudInsumo(actor:string,solicitud:string,motivo:string){
 const autenticado=await exigirGestionInsumos();
 if(actor!==autenticado.email)throw new Error('Actor inválido.');
 await obtenerBaseDatos().query(`SELECT public.cancelar_solicitud_insumos($1,$2,$3)`,[actor,solicitud,motivo]);
}

export async function guardarProductoInsumo(datos:{id?:string;codigo:string;nombre:string;categoria:string;unidad:string;activo:boolean;version?:number},solicitud:string=randomUUID()){
 const actor=await exigirGestionInsumos();
 const {rows}=await obtenerBaseDatos().query<{id:string}>('SELECT public.guardar_producto_insumo_acceso($1,$2::uuid,$3::jsonb) AS id',[actor.email,solicitud,JSON.stringify(datos)]);
 return rows[0].id;
}
export async function ingresarStockInsumo(productoId:string,cantidad:number,solicitud:string=randomUUID()){
 const actor=await exigirGestionInsumos();
 if(!esIdSede(productoId)||!Number.isInteger(cantidad)||cantidad<1||cantidad>100000)throw new Error('Producto o cantidad inválidos.');
 await obtenerBaseDatos().query('SELECT public.ingresar_stock_insumo_acceso($1,$2::uuid,$3::uuid,$4)',[actor.email,solicitud,productoId,cantidad]);
}

export type DatosCompraInsumo={productoId:string;version:number;nombre:string;categoria:string;unidad:string;cantidad:number;oc:string;fechaCompra:string};
export type IngresoInsumo={id:string;clase:'compra'|'saldo_anterior';cantidad:number;oc:string|null;fechaCompra:string|null;actor:string;registradoEn:string;producto:{codigo:string;nombre:string;categoria:string;unidad:string}};
export async function registrarCompraInsumo(solicitud:string,datos:DatosCompraInsumo){
 const actor=await exigirGestionInsumos();
 return (await obtenerBaseDatos().query<{r:{id:string;productoId:string;codigo:string;repetida:boolean}}>('SELECT public.registrar_compra_insumo_acceso($1,$2::uuid,$3::jsonb) AS r',[actor.email,solicitud,JSON.stringify(datos)])).rows[0].r;
}
export async function listarCategoriasCodigosInsumos(){await exigirGestionInsumos();return (await obtenerBaseDatos().query<{nombre:string;prefijo:string}>('SELECT nombre,prefijo FROM public.categorias_insumos_codigos ORDER BY lower(nombre)')).rows;}
export async function listarIngresosInsumo(productoId:string,pagina:number,limite:number){
 await exigirGestionInsumos();if(!esIdSede(productoId))throw new Error('Producto inválido.');
 const db=obtenerBaseDatos(),total=Number((await db.query<{n:string}>('SELECT count(*) AS n FROM public.ingresos_insumos WHERE producto_id=$1',[productoId])).rows[0].n),paginas=Math.max(1,Math.ceil(total/limite)),actual=Math.min(pagina,paginas);
 const {rows}=await db.query<IngresoInsumo>('SELECT id,clase,cantidad,oc,fecha_compra::text AS "fechaCompra",actor,registrado_en::text AS "registradoEn",producto FROM public.ingresos_insumos WHERE producto_id=$1 ORDER BY registrado_en DESC,id DESC LIMIT $2 OFFSET $3',[productoId,limite,(actual-1)*limite]);return {filas:rows,total,pagina:actual,paginas};
}
