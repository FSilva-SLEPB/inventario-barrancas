import "server-only";
import { exigirAcceso } from "@/lib/acceso";
import { requiereSede,puedeGestionarDependencias } from "@/lib/politica-acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { CAMPOS_COMPRA, valoresEquipo, type ValoresEquipo, type DatosEquipo } from "@/lib/validacion-equipos";
export type Equipo = DatosEquipo & { estadoAdministrativo:import('@/lib/estados-activo').EstadoAdministrativoActivo;fechaBaja:string|null;version:number; situacion:string; custodia:string; sedeNombre:string; sedeRbd:string|null;
  sedeTipo:string; categoriaNombre:string; fechaEntrega:string|null; enlaceActa:string|null; cargaId:string|null;
  archivoOrigen:string|null;filaOrigen:number|null;roboEstado:string|null };
export type HistorialEquipo = { actor:string; motivo:string; registradoEn:string; entregaId:string|null; incidenteId:string|null; antes:Record<string,unknown>|null; despues:Record<string,unknown> };
const seleccion=`SELECT e.id,e.sede_id AS "sedeId",e.categoria_id AS "categoriaId",e.marca,e.modelo,
  COALESCE(e.serie,'') AS serie,COALESCE(e.numero_inventario,'') AS inventario,
  e.motivo_identificacion AS "motivoIdentificacion",e.origen,e.condicion_tecnica AS "condicionTecnica",
  e.estado_administrativo AS "estadoAdministrativo",e.fecha_baja::text AS "fechaBaja",e.datos_compra AS compra,e.observaciones,e.version,e.situacion,e.custodia,
  e.fecha_entrega::text AS "fechaEntrega",e.enlace_acta AS "enlaceActa",e.carga_id AS "cargaId",
  e.fila_origen AS "filaOrigen",l.archivo AS "archivoOrigen",
  (SELECT i.estado FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id
   WHERE d.equipo_id=e.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL LIMIT 1) AS "roboEstado",
  s.nombre AS "sedeNombre",s.rbd AS "sedeRbd",s.tipo AS "sedeTipo",c.nombre AS "categoriaNombre"
  FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id JOIN public.categorias_bienes c ON c.id=e.categoria_id
  LEFT JOIN public.cargas_equipos l ON l.id=e.carga_id`;
export async function listarEquipos(ambito:string,vista:string,pagina:number,busqueda:string,tipo:string,sedeId:string|null,rbd="",tamano=50) {
  const acceso=await exigirAcceso();const local=requiereSede(acceso.rol);
  const limite=[50,100,150].includes(tamano)?tamano:50;
  const filtros=`WHERE ($1::boolean OR e.sede_id=$2::uuid)
    AND (($3='nc' AND s.tipo='nivel_central') OR ($3='eeji' AND s.tipo<>'nivel_central'))
    AND (($4='pendientes' AND e.custodia='en_bodega') OR ($4='inventario' AND e.custodia='asignado'))
    AND ($5='' OR e.marca ILIKE '%'||$5||'%' OR e.modelo ILIKE '%'||$5||'%'
      OR e.serie ILIKE '%'||$5||'%' OR e.numero_inventario ILIKE '%'||$5||'%' OR s.nombre ILIKE '%'||$5||'%' OR s.rbd ILIKE '%'||$5||'%'
      OR EXISTS (SELECT 1 FROM public.categorias_bienes c WHERE c.id=e.categoria_id AND c.nombre ILIKE '%'||$5||'%'))
    AND ($6='' OR s.tipo=$6) AND ($7::uuid IS NULL OR e.sede_id=$7::uuid)
    AND ($8='' OR s.rbd=$8)`;
  const params=[!local,acceso.sedeId,local ? "eeji" : ambito,vista,busqueda,tipo,sedeId,rbd];
  const db=obtenerBaseDatos();
  const total=Number((await db.query(`SELECT count(*) FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id ${filtros}`,params)).rows[0].count);
  const actual=Math.min(pagina,Math.max(1,Math.ceil(total/limite)));
  const {rows}=await db.query<Equipo>(`${seleccion} ${filtros} ORDER BY lower(s.nombre),e.numero_inventario NULLS LAST,e.id LIMIT $9 OFFSET $10`,[...params,limite,(actual-1)*limite]);
  return {equipos:rows,total,pagina:actual};
}
export async function obtenerEquipo(id:string):Promise<Equipo|null> {
  const acceso=await exigirAcceso();
  const {rows}=await obtenerBaseDatos().query<Equipo>(`${seleccion} WHERE e.id=$1::uuid AND ($2::boolean OR e.sede_id=$3::uuid)`,
    [id,!requiereSede(acceso.rol),acceso.sedeId]);return rows[0]??null;
}
export async function historialEquipo(id:string):Promise<HistorialEquipo[]> {
  const acceso=await exigirAcceso();
  return (await obtenerBaseDatos().query<HistorialEquipo>(`SELECT h.actor,CASE WHEN h.incidente_id IS NOT NULL AND NOT $4::boolean THEN 'Seguimiento de incidente de robo. Los antecedentes están disponibles para los perfiles de gestión autorizados.' ELSE h.motivo END AS motivo,h.registrado_en::text AS "registradoEn",h.entrega_id AS "entregaId",h.incidente_id AS "incidenteId",h.antes,h.despues
    FROM public.equipos_historial h JOIN public.equipos e ON e.id=h.equipo_id
    WHERE e.id=$1::uuid AND ($2::boolean OR (e.sede_id=$3::uuid AND h.despues->>'sede_id'=$3::text AND (h.antes IS NULL OR h.antes->>'sede_id'=$3::text))) ORDER BY h.id`,[id,!requiereSede(acceso.rol),acceso.sedeId,puedeGestionarDependencias(acceso.rol)])).rows;
}
export function equipoAFormulario(equipo:Equipo):ValoresEquipo {
  const valores=valoresEquipo();
  for(const campo of Object.keys(valores) as (keyof ValoresEquipo)[]) {
    const dato=equipo[campo as keyof Equipo];if(typeof dato==="string")valores[campo]=dato;
  }
  for(const campo of Object.keys(CAMPOS_COMPRA) as (keyof typeof CAMPOS_COMPRA)[]) {
    valores[campo]=typeof equipo.compra[campo]==="string"?equipo.compra[campo]:"";
  }
  return {...valores,version:String(equipo.version),motivoCambio:""};
}
