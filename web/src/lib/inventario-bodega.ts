import 'server-only';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
export type BienBodega={id:string;clase:'equipo'|'celular';sedeId:string;sedeNombre:string;sedeTipo:string;sedeRbd:string|null;categoriaNombre:string;marca:string;modelo:string;serie:string;inventario:string;telefono:string;condicionTecnica:string;situacion:string;version:number;roboEstado:string|null};
export type FiltrosBodega={tipo:string;sede:string;rbd:string;clase:string;q:string;pagina:number;limite:number};
const base=`WITH bienes AS (
 SELECT e.id,'equipo'::text AS clase,e.sede_id AS "sedeId",s.nombre AS "sedeNombre",s.tipo AS "sedeTipo",s.rbd AS "sedeRbd",c.nombre AS "categoriaNombre",e.marca,e.modelo,COALESCE(e.serie,'') AS serie,COALESCE(e.numero_inventario,'') AS inventario,''::text AS telefono,e.condicion_tecnica AS "condicionTecnica",e.situacion,e.version,
 (SELECT i.estado FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=e.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL LIMIT 1) AS "roboEstado"
 FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id JOIN public.categorias_bienes c ON c.id=e.categoria_id WHERE e.custodia='en_bodega'
 UNION ALL
 SELECT c.id,'celular'::text,c.sede_id,s.nombre,s.tipo,s.rbd,'Celular'::text,c.marca,c.modelo,COALESCE(c.imei,''),COALESCE(c.numero_inventario,''),c.telefono,c.condicion_tecnica,'en_bodega'::text,c.version,NULL::text
 FROM public.celulares c JOIN public.sedes s ON s.id=c.sede_id WHERE c.custodia='en_bodega' AND c.activo
) `;
export async function listarBodega(f:FiltrosBodega){
 await exigirAdministrador();const db=obtenerBaseDatos(),where=`WHERE ($1='' OR "sedeTipo"=$1) AND ($2::uuid IS NULL OR "sedeId"=$2::uuid) AND ($3='' OR "sedeRbd"=$3) AND ($4='' OR clase=$4) AND ($5='' OR "sedeNombre" ILIKE '%'||$5||'%' OR "sedeRbd" ILIKE '%'||$5||'%' OR "categoriaNombre" ILIKE '%'||$5||'%' OR marca ILIKE '%'||$5||'%' OR modelo ILIKE '%'||$5||'%' OR serie ILIKE '%'||$5||'%' OR inventario ILIKE '%'||$5||'%' OR telefono ILIKE '%'||$5||'%')`,p=[f.tipo,f.sede||null,f.rbd,f.clase,f.q];
 const total=Number((await db.query<{n:string}>(base+'SELECT count(*) AS n FROM bienes '+where,p)).rows[0].n),paginas=Math.max(1,Math.ceil(total/f.limite)),pagina=Math.min(f.pagina,paginas);
 const {rows}=await db.query<BienBodega>(base+`SELECT * FROM bienes ${where} ORDER BY lower("sedeNombre"),clase,inventario,id LIMIT $6 OFFSET $7`,[...p,f.limite,(pagina-1)*f.limite]);return {filas:rows,total,pagina,paginas};
}
export async function listarMovimientosInventario(f:{q:string;pagina:number;limite:number;accion:string}){
 await exigirAdministrador();const db=obtenerBaseDatos(),base=`FROM public.movimientos_inventario m WHERE ($1='' OR m.accion=$1) AND ($2='' OR m.receptor ILIKE '%'||$2||'%' OR m.motivo ILIKE '%'||$2||'%' OR m.antes->>'sedeNombre' ILIKE '%'||$2||'%' OR m.despues->>'sedeNombre' ILIKE '%'||$2||'%' OR m.despues->>'destinoPrestamoNombre' ILIKE '%'||$2||'%' OR m.despues->>'telefono' ILIKE '%'||$2||'%' OR m.despues->>'numero_inventario' ILIKE '%'||$2||'%' OR m.despues->>'inventario' ILIKE '%'||$2||'%')`,p=[f.accion,f.q];
 const total=Number((await db.query<{n:string}>('SELECT count(*) AS n '+base,p)).rows[0].n),paginas=Math.max(1,Math.ceil(total/f.limite)),pagina=Math.min(f.pagina,paginas);
 const {rows}=await db.query<{id:string;clase:'equipo'|'celular';bienId:string;actaId:string|null;accion:string;fecha:string;receptor:string;actor:string;motivo:string;antes:Record<string,unknown>;despues:Record<string,unknown>}>('SELECT m.id,(SELECT a.id FROM public.actas_documentos a WHERE a.movimiento_id=m.id AND a.pdf IS NOT NULL) AS "actaId",CASE WHEN m.equipo_id IS NOT NULL THEN \'equipo\' ELSE \'celular\' END AS clase,COALESCE(m.equipo_id,m.celular_id) AS "bienId",m.accion,m.fecha::text,m.receptor,m.actor,m.motivo,m.antes,m.despues '+base+' ORDER BY m.registrado_en DESC,m.id DESC LIMIT $3 OFFSET $4',[...p,f.limite,(pagina-1)*f.limite]);return {filas:rows,total,pagina,paginas};
}
