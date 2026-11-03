import 'server-only';
import { exigirAcceso,exigirGestionDependencias } from '@/lib/acceso';
import { requiereSede } from '@/lib/politica-acceso';
import { obtenerBaseDatos } from '@/lib/db';
export type FiltrosRobos={ambito:string;sede:string;comuna:string;estado:string;desde:string;hasta:string;q:string;pagina:number};
export type FilaRobo={incidenteId:string;equipoId:string;sedeNombre:string;rbd:string|null;sedeTipo:string;comuna:string|null;fecha:string;estado:keyof typeof import('./validacion-robos').ESTADOS_ROBO;marca:string;modelo:string;serie:string|null;inventario:string|null;categoria:string};
export type EquipoRobo={id:string;version:number;marca:string;modelo:string;serie:string|null;inventario:string|null;incidenteAbierto:boolean;sedeId:string;sedeNombre:string;rbd:string|null;comuna:string|null};
const estado="CASE WHEN d.recuperado_fecha IS NOT NULL THEN 'recuperado' ELSE i.estado END";
const filtros=`WHERE ($1::boolean OR i.sede_id=$2::uuid) AND ($3='' OR ($3='nc' AND i.sede_tipo='nivel_central') OR ($3='eeji' AND i.sede_tipo<>'nivel_central'))
 AND ($4::uuid IS NULL OR i.sede_id=$4::uuid) AND ($5='' OR i.comuna=$5) AND ($6='' OR ${estado}=$6)
 AND ($7::date IS NULL OR i.fecha>=$7::date) AND ($8::date IS NULL OR i.fecha<=$8::date)
 AND ($9='' OR i.sede_nombre ILIKE '%'||$9||'%' OR i.sede_rbd ILIKE '%'||$9||'%' OR d.identificacion->>'serie' ILIKE '%'||$9||'%'
  OR d.identificacion->>'inventario' ILIKE '%'||$9||'%' OR d.identificacion->>'marca' ILIKE '%'||$9||'%'
  OR d.identificacion->>'modelo' ILIKE '%'||$9||'%' OR d.identificacion->>'categoria' ILIKE '%'||$9||'%')`;
const base='FROM public.incidentes_robos i JOIN public.incidentes_robos_equipos d ON d.incidente_id=i.id';
export async function consolidadoRobos(f:FiltrosRobos){
 const actor=await exigirAcceso(),db=obtenerBaseDatos();
 const parametros=[!requiereSede(actor.rol),actor.sedeId,f.ambito,f.sede||null,f.comuna,f.estado,f.desde||null,f.hasta||null,f.q];
 const [resumen,grupos]=await Promise.all([
  db.query<{filas:string;equipos:string;incidentes:string;reportados:string;robados:string;recuperados:string}>(`SELECT count(*) AS filas,count(DISTINCT d.equipo_id) AS equipos,count(DISTINCT i.id) AS incidentes,
   count(DISTINCT d.equipo_id) FILTER(WHERE i.estado='reportado') AS reportados,
   count(DISTINCT d.equipo_id) FILTER(WHERE i.estado='validado' AND d.recuperado_fecha IS NULL) AS robados,
   count(DISTINCT d.equipo_id) FILTER(WHERE d.recuperado_fecha IS NOT NULL) AS recuperados ${base} ${filtros}`,parametros),
  db.query<{sedeId:string;sedeNombre:string;rbd:string|null;comuna:string|null;robados:string;reportados:string;recuperados:string}>(`SELECT i.sede_id AS "sedeId",i.sede_nombre AS "sedeNombre",i.sede_rbd AS rbd,i.comuna,
   count(DISTINCT d.equipo_id) FILTER(WHERE i.estado='validado' AND d.recuperado_fecha IS NULL) AS robados,
   count(DISTINCT d.equipo_id) FILTER(WHERE i.estado='reportado') AS reportados,
   count(DISTINCT d.equipo_id) FILTER(WHERE d.recuperado_fecha IS NOT NULL) AS recuperados ${base} ${filtros}
   GROUP BY i.sede_id,i.sede_nombre,i.sede_rbd,i.comuna ORDER BY robados DESC,lower(i.sede_nombre)`,parametros)
 ]);
 const total=Number(resumen.rows[0].filas),pagina=Math.min(f.pagina,Math.max(1,Math.ceil(total/50)));
 const {rows}=await db.query<FilaRobo>(`SELECT i.id AS "incidenteId",d.equipo_id AS "equipoId",i.sede_nombre AS "sedeNombre",i.sede_rbd AS rbd,i.sede_tipo AS "sedeTipo",i.comuna,i.fecha::text,${estado} AS estado,
   d.identificacion->>'marca' AS marca,d.identificacion->>'modelo' AS modelo,d.identificacion->>'serie' AS serie,d.identificacion->>'inventario' AS inventario,d.identificacion->>'categoria' AS categoria
   ${base} ${filtros} ORDER BY i.fecha DESC,i.id,d.equipo_id LIMIT 50 OFFSET $10`,[...parametros,(pagina-1)*50]);
 return {filas:rows,resumen:resumen.rows[0],grupos:grupos.rows,pagina,paginas:Math.max(1,Math.ceil(total/50))};
}
export async function equiposParaRobo(sede:string|null,q:string,equipo:string|null=null){
 const actor=await exigirGestionDependencias();
 return(await obtenerBaseDatos().query<EquipoRobo>(`SELECT e.id,e.version,e.marca,e.modelo,e.serie,e.numero_inventario AS inventario,e.sede_id AS "sedeId",s.nombre AS "sedeNombre",s.rbd,s.comuna,
 EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=e.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) AS "incidenteAbierto"
 FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id WHERE ($1::uuid IS NULL OR e.sede_id=$1::uuid) AND s.activo AND ($2::boolean OR e.sede_id=$3::uuid)
 AND ($4='' OR e.marca ILIKE '%'||$4||'%' OR e.modelo ILIKE '%'||$4||'%' OR e.serie ILIKE '%'||$4||'%' OR e.numero_inventario ILIKE '%'||$4||'%')
 AND ($5::uuid IS NULL OR e.id=$5::uuid) ORDER BY lower(s.nombre),e.numero_inventario NULLS LAST,e.id LIMIT 51`,[sede,!requiereSede(actor.rol),actor.sedeId,q,equipo])).rows;
}
export type IncidenteRobo={id:string;sedeId:string;sedeNombre:string;rbd:string|null;comuna:string|null;fecha:string;lugar:string;descripcion:string;enlace:string|null;estado:string;version:number;reportadoPor:string};
export type DetalleRobo={equipoId:string;identificacion:{marca:string;modelo:string;serie:string|null;inventario:string|null;categoria:string};recuperadoFecha:string|null;recuperadoPor:string|null;motivo:string|null};
export async function detalleRobo(id:string){
 const actor=await exigirGestionDependencias(),db=obtenerBaseDatos();
 const {rows}=await db.query<IncidenteRobo>(`SELECT id,sede_id AS "sedeId",sede_nombre AS "sedeNombre",sede_rbd AS rbd,comuna,fecha::text,lugar,descripcion,enlace,estado,version,reportado_por AS "reportadoPor" FROM public.incidentes_robos WHERE id=$1::uuid AND ($2::boolean OR sede_id=$3::uuid)`,[id,!requiereSede(actor.rol),actor.sedeId]);
 if(!rows[0])return null;
 const [equipos,historial]=await Promise.all([
  db.query<DetalleRobo>('SELECT equipo_id AS "equipoId",identificacion,recuperado_fecha::text AS "recuperadoFecha",recuperado_por AS "recuperadoPor",recuperacion_motivo AS motivo FROM public.incidentes_robos_equipos WHERE incidente_id=$1::uuid ORDER BY equipo_id',[id]),
  db.query<{id:string;evento:string;actor:string;motivo:string;fecha:string;equipoId:string|null}>('SELECT id,evento,actor,motivo,registrado_en::text AS fecha,equipo_id AS "equipoId" FROM public.incidentes_robos_historial WHERE incidente_id=$1::uuid ORDER BY registrado_en,id',[id])]);
 return {incidente:rows[0],equipos:equipos.rows,historial:historial.rows};
}
export async function robosEquipo(id:string){
 const actor=await exigirAcceso();
 return(await obtenerBaseDatos().query<{id:string;estado:string;fecha:string;recuperadoFecha:string|null}>(`SELECT i.id,i.estado,i.fecha::text,d.recuperado_fecha::text AS "recuperadoFecha" ${base}
 JOIN public.equipos e ON e.id=d.equipo_id WHERE d.equipo_id=$1::uuid AND ($2::boolean OR e.sede_id=$3::uuid) ORDER BY i.fecha DESC,i.id`,[id,!requiereSede(actor.rol),actor.sedeId])).rows;
}

export async function dashboardRobos(f:FiltrosRobos){
 const {periodosDashboard}=await import('@/lib/dashboard-robos');
 const {unidad,periodos}=periodosDashboard(f),actor=await exigirAcceso();
 const parametros=[!requiereSede(actor.rol),actor.sedeId,f.ambito,f.sede||null,f.comuna,f.estado,f.desde||null,f.hasta||null,f.q,unidad,unidad==='month'?'YYYY-MM':'YYYY'];
 // Una sola instantánea de lectura para que tarjetas y gráficos describan el mismo conjunto.
 const contar=`count(DISTINCT equipo_id)::int AS equipos,count(DISTINCT incidente_id)::int AS incidentes,
 count(DISTINCT equipo_id) FILTER(WHERE estado='validado')::int AS robados,
 count(DISTINCT equipo_id) FILTER(WHERE estado='reportado')::int AS reportados,
 count(DISTINCT equipo_id) FILTER(WHERE estado='recuperado')::int AS recuperados,
 count(DISTINCT equipo_id) FILTER(WHERE estado='rechazado')::int AS rechazados`;
 const {rows}=await obtenerBaseDatos().query<{datos:Omit<import('./dashboard-robos').DatosDashboardRobos,'unidad'|'consultado'|'serie'>&{serie:{periodo:string;incidentes:number;equipos:number}[]}}>(`WITH filtrados AS MATERIALIZED (
 SELECT i.id AS incidente_id,d.equipo_id,i.sede_id,i.sede_nombre,i.sede_rbd,i.comuna,i.fecha,i.registrado_en,${estado} AS estado,
 COALESCE(NULLIF(d.identificacion->>'categoria',''),'Sin categoría informada') AS categoria ${base} ${filtros}
 ),por_sede AS (
 SELECT sede_id::text AS clave,(array_agg(sede_nombre ORDER BY fecha DESC,registrado_en DESC,incidente_id DESC))[1] AS nombre,
 (array_agg(sede_rbd ORDER BY fecha DESC,registrado_en DESC,incidente_id DESC))[1] AS rbd,
 string_agg(DISTINCT comuna,', ' ORDER BY comuna) AS comunas,${contar} FROM filtrados GROUP BY sede_id
 ),por_comuna AS (
 SELECT COALESCE(NULLIF(comuna,''),'Sin comuna informada') AS clave,COALESCE(NULLIF(comuna,''),'Sin comuna informada') AS nombre,${contar}
 FROM filtrados GROUP BY COALESCE(NULLIF(comuna,''),'Sin comuna informada')
 ),por_categoria AS (
 SELECT categoria AS clave,categoria AS nombre,${contar} FROM filtrados GROUP BY categoria
 ),por_periodo AS (
 SELECT to_char(date_trunc($10::text,fecha),$11::text) AS periodo,count(DISTINCT incidente_id)::int AS incidentes,count(DISTINCT equipo_id)::int AS equipos
 FROM filtrados GROUP BY periodo
 ) SELECT jsonb_build_object(
 'resumen',(SELECT to_jsonb(t) FROM (SELECT ${contar} FROM filtrados)t),
 'sedes',COALESCE((SELECT jsonb_agg(t ORDER BY robados DESC,reportados DESC,recuperados DESC,nombre,clave) FROM por_sede t),'[]'::jsonb),
 'comunas',COALESCE((SELECT jsonb_agg(t ORDER BY nombre) FROM por_comuna t),'[]'::jsonb),
 'categorias',COALESCE((SELECT jsonb_agg(t ORDER BY nombre) FROM por_categoria t),'[]'::jsonb),
 'serie',COALESCE((SELECT jsonb_agg(t ORDER BY periodo) FROM por_periodo t),'[]'::jsonb)) AS datos`,parametros);
 const datos=rows[0].datos,porPeriodo=new Map(datos.serie.map(p=>[p.periodo,p]));
 return {...datos,serie:periodos.map(p=>({...p,incidentes:porPeriodo.get(p.periodo)?.incidentes??0,equipos:porPeriodo.get(p.periodo)?.equipos??0})),unidad,consultado:new Date().toISOString()};
}
