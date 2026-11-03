import 'server-only';
import {exigirAcceso} from '@/lib/acceso';
import {requiereSede} from '@/lib/politica-acceso';
import {obtenerBaseDatos} from '@/lib/db';
import type {DatosCelular} from '@/lib/validacion-celulares';
export type Celular=DatosCelular&{id:string;version:number;sedeNombre:string;rbd:string|null;sedeTipo:string;actualizadoPor:string;actualizadoEn:string};
export type FiltrosCelulares={q:string;tipo:string;sede:string;estado:string;pagina:number;limite:number};
const columnas=`c.id,c.sede_id::text AS "sedeId",c.telefono,c.marca,c.modelo,COALESCE(c.imei,'') AS imei,COALESCE(c.numero_inventario,'') AS inventario,c.condicion_tecnica AS "condicionTecnica",c.responsable,c.observaciones,c.activo,c.version,s.nombre AS "sedeNombre",s.rbd,s.tipo AS "sedeTipo",c.actualizado_por AS "actualizadoPor",c.actualizado_en::text AS "actualizadoEn"`;
const base='FROM public.celulares c JOIN public.sedes s ON s.id=c.sede_id';
export async function listarCelulares(f:FiltrosCelulares){
 const actor=await exigirAcceso(),db=obtenerBaseDatos(),local=requiereSede(actor.rol);
 const filtro=`WHERE ($1::boolean OR c.sede_id=$2::uuid) AND ($3='' OR s.tipo=$3) AND ($4::uuid IS NULL OR c.sede_id=$4::uuid)
 AND ($5='' OR c.activo=($5='activo')) AND ($6='' OR s.nombre ILIKE '%'||$6||'%' OR s.rbd ILIKE '%'||$6||'%' OR c.telefono ILIKE '%'||regexp_replace($6,'[ ().-]','','g')||'%' OR c.marca ILIKE '%'||$6||'%' OR c.modelo ILIKE '%'||$6||'%' OR c.imei ILIKE '%'||$6||'%' OR c.numero_inventario ILIKE '%'||$6||'%' OR c.responsable ILIKE '%'||$6||'%')`;
 const p=[!local,actor.sedeId,local?'':f.tipo,local?null:f.sede||null,f.estado,f.q];
 const total=Number((await db.query<{n:string}>('SELECT count(*) AS n '+base+' '+filtro,p)).rows[0].n),paginas=Math.max(1,Math.ceil(total/f.limite)),pagina=Math.min(f.pagina,paginas);
 const {rows}=await db.query<Celular>(`SELECT ${columnas} ${base} ${filtro} ORDER BY lower(s.nombre),c.telefono,c.id LIMIT $7 OFFSET $8`,[...p,f.limite,(pagina-1)*f.limite]);
 return {filas:rows,total,pagina,paginas};
}
export async function detalleCelular(id:string){
 const actor=await exigirAcceso(),db=obtenerBaseDatos(),global=!requiereSede(actor.rol);
 const {rows}=await db.query<Celular>(`SELECT ${columnas} ${base} WHERE c.id=$1::uuid AND ($2::boolean OR c.sede_id=$3::uuid)`,[id,global,actor.sedeId]);if(!rows[0])return null;
 const historial=await db.query<{id:string;actor:string;motivo:string;antes:Record<string,unknown>|null;despues:Record<string,unknown>;fecha:string}>(`SELECT h.id::text,h.actor,h.motivo,h.antes,h.despues,h.registrado_en::text AS fecha FROM public.celulares_historial h WHERE h.celular_id=$1::uuid AND ($2::boolean OR (h.despues->>'sedeId'=$3 AND (h.antes IS NULL OR h.antes->>'sedeId'=$3))) ORDER BY h.registrado_en DESC,h.id DESC LIMIT 50`,[id,global,actor.sedeId]);
 return {celular:rows[0],historial:historial.rows};
}
