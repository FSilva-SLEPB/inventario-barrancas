import "server-only";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
export type DirectorSede = { sedeId:string; sedeNombre:string; rbd:string|null; tipo:string; comuna:string|null; nombre:string|null; cargo:string|null; version:number; rut:string|null;correo:string|null;situacion:string|null;observaciones:string|null;direccion:string|null;correoInstitucional:string|null };
export async function listarDirectorio(): Promise<DirectorSede[]> {
  await exigirAdministrador();
  return (await obtenerBaseDatos().query<DirectorSede>(`SELECT s.id AS "sedeId",s.nombre AS "sedeNombre",s.rbd,s.tipo,s.comuna,s.direccion,s.correo_institucional AS "correoInstitucional",
    d.nombre,d.cargo,d.rut,d.correo,d.situacion,d.observaciones,COALESCE(d.version,0) AS version FROM public.sedes s LEFT JOIN public.directorio_sedes d ON d.sede_id=s.id
    WHERE s.tipo IN ('establecimiento','jardin_infantil') AND s.activo ORDER BY s.tipo,lower(s.nombre),s.id`)).rows;
}
export async function historialDirectorio(sede: string) {
  await exigirAdministrador();
  return (await obtenerBaseDatos().query<{actor:string;motivo:string;fecha:string;antes:Record<string,unknown>|null;despues:Record<string,unknown>}>(
    'SELECT actor,motivo,registrado_en::text AS fecha,antes,despues FROM public.directorio_historial WHERE sede_id=$1::uuid ORDER BY registrado_en DESC,id DESC LIMIT 50',[sede])).rows;
}
