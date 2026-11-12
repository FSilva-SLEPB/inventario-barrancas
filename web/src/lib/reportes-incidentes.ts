import 'server-only';
import {exigirAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {puedeAdministrar,requiereSede} from '@/lib/politica-acceso';
export type BienReporte={id:string;clase:'equipo'|'celular';version:number;marca:string;modelo:string;inventario:string;serie:string;sedeId?:string};
export type DatosReporte={sedeId:string;tipo:'robo'|'sustraccion'|'dano';fecha:string;parte:string;denunciante:string;rut:string;descripcion:string;bienes:BienReporte[]};
export type ReporteIncidente={id:string;sede_id:string;actor:string;datos:DatosReporte;estado:'borrador'|'enviado'|'validado'|'rechazado';version:number;sede:string;sede_tipo:string;comuna:string|null;informes:number;motivo_validacion:string|null};
export async function listarReportesIncidentes(){
 const a=await exigirAcceso();const {rows}=await obtenerBaseDatos().query<ReporteIncidente>(`SELECT r.*,s.nombre AS sede,s.tipo AS sede_tipo,s.comuna,(SELECT count(*)::integer FROM public.reportes_incidentes_adjuntos WHERE reporte_id=r.id) AS informes FROM public.reportes_incidentes_inventario r JOIN public.sedes s ON s.id=r.sede_id WHERE ($1::boolean OR r.sede_id=$2::uuid) ORDER BY r.registrado_en DESC,r.id`,[!requiereSede(a.rol),a.sedeId]);return rows;
}
export async function obtenerReporteIncidente(id:string){
 const a=await exigirAcceso();if(!puedeAdministrar(a.rol)&&a.rol!=='encargado')return null;
 const r=(await listarReportesIncidentes()).find(r=>r.id===id);if(!r)return null;
 const adjuntos=(await obtenerBaseDatos().query<{id:string;nombre:string}>('SELECT id,nombre FROM public.reportes_incidentes_adjuntos WHERE reporte_id=$1 ORDER BY registrado_en,id',[id])).rows;
 return {reporte:r,adjuntos};
}
export async function bienesParaReporte(){
 const a=await exigirAcceso();if(!puedeAdministrar(a.rol)&&a.rol!=='encargado')return [];
 return (await obtenerBaseDatos().query<BienReporte>(`SELECT id,'equipo' AS clase,version,marca,modelo,COALESCE(numero_inventario,'') AS inventario,COALESCE(serie,'') AS serie,sede_id::text AS "sedeId" FROM public.equipos WHERE NOT EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=equipos.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) AND custodia='asignado' AND estado_administrativo='activo' AND ($1::boolean OR sede_id=$2::uuid)
 UNION ALL SELECT id,'celular',version,marca,modelo,COALESCE(numero_inventario,''),COALESCE(imei,''),sede_id::text FROM public.celulares WHERE activo AND custodia='asignado' AND estado_administrativo='activo' AND ($1::boolean OR sede_id=$2::uuid) ORDER BY clase,marca,modelo,id`,[!requiereSede(a.rol),a.sedeId])).rows;
}
export function estadoReporte(r: Pick<ReporteIncidente,'estado'|'informes'>){return r.estado==='borrador'?'Borrador':r.estado==='validado'?'Validado por TI':r.estado==='rechazado'?'Rechazado por TI':r.informes?'Pendiente de validación TI':'Pendiente de informe · Enviado a TI';}
