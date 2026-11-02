import "server-only";
import { exigirAcceso } from "@/lib/acceso";
import { requiereSede } from "@/lib/politica-acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { CAMPOS_COMPRA, valoresEquipo, type ValoresEquipo, type DatosEquipo } from "@/lib/validacion-equipos";
export type Equipo = DatosEquipo & { version:number; situacion:string; sedeNombre:string; sedeRbd:string|null;
  sedeTipo:string; categoriaNombre:string; fechaEntrega:string|null; enlaceActa:string|null; cargaId:string|null;
  archivoOrigen:string|null;filaOrigen:number|null };
export type HistorialEquipo = { actor:string; motivo:string; registradoEn:string; antes:Record<string,unknown>|null; despues:Record<string,unknown> };
const seleccion=`SELECT e.id,e.sede_id AS "sedeId",e.categoria_id AS "categoriaId",e.marca,e.modelo,
  COALESCE(e.serie,'') AS serie,COALESCE(e.numero_inventario,'') AS inventario,
  e.motivo_identificacion AS "motivoIdentificacion",e.origen,e.condicion_tecnica AS "condicionTecnica",
  e.datos_compra AS compra,e.observaciones,e.version,e.situacion,
  e.fecha_entrega::text AS "fechaEntrega",e.enlace_acta AS "enlaceActa",e.carga_id AS "cargaId",
  e.fila_origen AS "filaOrigen",l.archivo AS "archivoOrigen",
  s.nombre AS "sedeNombre",s.rbd AS "sedeRbd",s.tipo AS "sedeTipo",c.nombre AS "categoriaNombre"
  FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id JOIN public.categorias_bienes c ON c.id=e.categoria_id
  LEFT JOIN public.cargas_equipos l ON l.id=e.carga_id`;
export async function listarEquipos(ambito:string,vista:string,pagina:number,busqueda:string,tipo:string,sedeId:string|null,rbd="",tamano=50) {
  const acceso=await exigirAcceso();const local=requiereSede(acceso.rol);
  const limite=[50,100,150].includes(tamano)?tamano:50;
  const filtros=`WHERE ($1::boolean OR e.sede_id=$2::uuid)
    AND (($3='nc' AND s.tipo='nivel_central') OR ($3='eeji' AND s.tipo<>'nivel_central'))
    AND (($4='pendientes' AND e.situacion='pendiente_entrega') OR ($4='inventario' AND e.situacion<>'pendiente_entrega'))
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
  return (await obtenerBaseDatos().query<HistorialEquipo>(`SELECT h.actor,h.motivo,h.registrado_en::text AS "registradoEn",h.antes,h.despues
    FROM public.equipos_historial h JOIN public.equipos e ON e.id=h.equipo_id
    WHERE e.id=$1::uuid AND ($2::boolean OR e.sede_id=$3::uuid) ORDER BY h.id`,[id,!requiereSede(acceso.rol),acceso.sedeId])).rows;
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
