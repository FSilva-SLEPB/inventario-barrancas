import {tienePermiso} from '@/lib/rbac';
import "server-only";
import { exigirAlguno } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
export type DirectorSede = { sedeId:string; sedeNombre:string; rbd:string|null; tipo:string; comuna:string|null; nombre:string|null; nombres:string|null; apellidos:string|null; cargo:string|null; version:number; rut:string|null;correo:string|null;situacion:string|null;observaciones:string|null;direccion:string|null;correoInstitucional:string|null };
export async function listarDirectorio(): Promise<DirectorSede[]> {
  const actor=await exigirAlguno('directorio_personas.consultar','directorio_institucional.consultar');
  return (await obtenerBaseDatos().query<DirectorSede>(`SELECT s.id AS "sedeId",s.nombre AS "sedeNombre",s.rbd,s.tipo,s.comuna,s.direccion,s.correo_institucional AS "correoInstitucional",
    CASE WHEN $3::boolean THEN d.nombre END AS nombre,CASE WHEN $3::boolean THEN d.nombres END AS nombres,CASE WHEN $3::boolean THEN d.apellidos END AS apellidos,CASE WHEN $3::boolean THEN d.cargo END AS cargo,CASE WHEN $3::boolean THEN d.rut END AS rut,CASE WHEN $3::boolean THEN d.correo END AS correo,CASE WHEN $3::boolean THEN d.situacion END AS situacion,CASE WHEN $3::boolean THEN d.observaciones END AS observaciones,COALESCE(d.version,0) AS version FROM public.sedes s LEFT JOIN public.directorio_sedes d ON d.sede_id=s.id
    WHERE ($1::boolean OR s.id=$2::uuid) AND s.tipo IN ('establecimiento','jardin_infantil') AND s.activo ORDER BY s.tipo,lower(s.nombre),s.id`,[actor.alcance==='global',actor.sedeId,tienePermiso(actor,'directorio_personas')])).rows;
}
export async function historialDirectorio(sede: string) {
  const actor=await exigirAlguno('directorio_personas.consultar','directorio_institucional.consultar');
  if(actor.alcance!=='global'&&actor.sedeId!==sede)return [];
  return (await obtenerBaseDatos().query<{actor:string;motivo:string;fecha:string;antes:Record<string,unknown>|null;despues:Record<string,unknown>}>(
    `SELECT COALESCE(NULLIF(btrim(u.nombre),''),'Funcionario UTIC') AS actor,motivo,registrado_en::text AS fecha,CASE WHEN $2::boolean THEN antes ELSE jsonb_build_object('sede',antes->'sede') END AS antes,CASE WHEN $2::boolean THEN despues ELSE jsonb_build_object('sede',despues->'sede') END AS despues FROM public.directorio_historial h LEFT JOIN public.usuarios_acceso u ON u.correo=h.actor WHERE h.sede_id=$1::uuid ORDER BY registrado_en DESC,id DESC LIMIT 50`,
    [sede,tienePermiso(actor,'directorio_personas')])).rows;
}
