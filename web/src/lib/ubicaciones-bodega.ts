import 'server-only';
import {exigirPermiso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
export type UbicacionBodega={id:string;nombre:string;referencia:string;activo:boolean};
export async function listarUbicacionesBodega(){await exigirPermiso('bodega','consultar');return (await obtenerBaseDatos().query<UbicacionBodega>('SELECT id,nombre,referencia,activo FROM public.ubicaciones_bodega ORDER BY codigo')).rows;}
export async function detalleUbicacionBodega(tipo:'equipo'|'celular',id:string){
 const actor=await exigirPermiso('bodega','consultar');if(!esIdSede(id))return null;
 const equipo=tipo==='equipo',tabla=equipo?'equipos':'celulares';
 const {rows}=await obtenerBaseDatos().query<{id:string;marca:string;modelo:string;identificador:string;version:number;ubicacion:string;ubicacionNombre:string;custodia:string;administrativo:string;activo:boolean;incidente:boolean}>(`SELECT b.id,b.marca,b.modelo,COALESCE(b.numero_inventario,${equipo?'b.serie':'b.telefono'},'') AS identificador,b.version,COALESCE(b.ubicacion_bodega_id::text,'') AS ubicacion,COALESCE(u.nombre,'Sin ubicación confirmada') AS "ubicacionNombre",b.custodia,b.estado_administrativo AS administrativo,${equipo?'true':'b.activo'} AS activo,${equipo?"EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=b.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL)":'false'} AS incidente FROM public.${tabla} b LEFT JOIN public.ubicaciones_bodega u ON u.id=b.ubicacion_bodega_id WHERE b.id=$1 AND ($2::boolean OR b.sede_id=$3::uuid)`,[id,actor.alcance==='global',actor.sedeId]);
 if(!rows[0])return null;
 const historial=(await obtenerBaseDatos().query<{id:string;actor:string;fecha:string;antes:string;despues:string}>(`SELECT h.id,h.actor,h.registrado_en::text AS fecha,COALESCE(a.nombre,'Sin ubicación confirmada') AS antes,COALESCE(d.nombre,'Sin ubicación confirmada') AS despues FROM public.ubicaciones_bodega_historial h LEFT JOIN public.ubicaciones_bodega a ON a.id=(h.antes->>'ubicacion_bodega_id')::uuid LEFT JOIN public.ubicaciones_bodega d ON d.id=(h.despues->>'ubicacion_bodega_id')::uuid WHERE ${equipo?'equipo_id':'celular_id'}=$1 ORDER BY h.registrado_en DESC,h.id DESC LIMIT 30`,[id])).rows;
 return {...rows[0],historial};
}
