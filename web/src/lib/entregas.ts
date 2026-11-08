import "server-only";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { esIdSede } from "@/lib/validacion-sedes";
export class ErrorSeleccionEntrega extends Error {}
export type EquipoEntrega = { id: string; version: number; sedeId: string; sedeNombre: string; rbd: string | null; comuna: string | null;
  directoraNombre: string | null; directoraRut:string|null;directoraCorreo:string|null;direccion:string|null;correoInstitucional:string|null;sedeVersion:string; marca: string; modelo: string; serie: string | null; inventario: string | null };

export async function seleccionarEntregas(p: Record<string,string|string[]|undefined>): Promise<EquipoEntrega[]> {
  await exigirAdministrador();
  const todos = p.todos === "si";
  const ids = typeof p.equipo === "string" ? [p.equipo] : p.equipo ?? [];
  if (!todos && (!ids.length || ids.length > 2500 || ids.some(id => !esIdSede(id)) || new Set(ids.map(id=>id.toLowerCase())).size !== ids.length))
    throw new ErrorSeleccionEntrega("Selecciona uno o varios equipos desde Bodega TI.");
  const tipo = p.tipo === "establecimiento" || p.tipo === "jardin_infantil" ? p.tipo : "";
  const sede = tipo && typeof p.sede === "string" && esIdSede(p.sede) ? p.sede : null;
  const rbd = tipo && typeof p.rbd === "string" ? p.rbd.trim().slice(0,120) : "";
  const q = typeof p.q === "string" ? p.q.trim().slice(0,120) : "";
  const { rows } = await obtenerBaseDatos().query<EquipoEntrega>(`SELECT e.id,e.version,e.sede_id AS "sedeId",s.nombre AS "sedeNombre",s.rbd,s.comuna,s.direccion,s.correo_institucional AS "correoInstitucional",jsonb_build_array(s.nombre,COALESCE(s.direccion,''),COALESCE(s.comuna,''),COALESCE(s.correo_institucional,''))::text AS "sedeVersion",
    CASE WHEN d.situacion IN ('titular','subrogante') THEN d.nombre END AS "directoraNombre",d.rut AS "directoraRut",d.correo AS "directoraCorreo",e.marca,e.modelo,e.serie,e.numero_inventario AS inventario
    FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id LEFT JOIN public.directorio_sedes d ON d.sede_id=s.id
    WHERE e.situacion='pendiente_entrega' AND s.tipo='jardin_infantil' AND s.activo
      AND ($1::boolean OR e.id=ANY($2::uuid[]))
      AND (NOT $1::boolean OR (($3='' OR s.tipo=$3) AND ($4::uuid IS NULL OR s.id=$4::uuid) AND ($5='' OR s.rbd=$5)
        AND ($6='' OR e.marca ILIKE '%'||$6||'%' OR e.modelo ILIKE '%'||$6||'%' OR e.serie ILIKE '%'||$6||'%' OR e.numero_inventario ILIKE '%'||$6||'%'
          OR s.nombre ILIKE '%'||$6||'%' OR s.rbd ILIKE '%'||$6||'%' OR EXISTS(SELECT 1 FROM public.categorias_bienes c WHERE c.id=e.categoria_id AND c.nombre ILIKE '%'||$6||'%'))))
    ORDER BY lower(s.nombre),e.numero_inventario NULLS LAST,e.id LIMIT 2501`, [todos, todos ? [] : ids,tipo,sede,rbd,q]);
  if (!rows.length || rows.length>2500 || (!todos && rows.length!==ids.length)) throw new ErrorSeleccionEntrega("Revisa la selección: deben ser entre 1 y 2.500 equipos pendientes de jardines activos.");
  return rows;
}
export async function listarEntregas() {
  await exigirAdministrador();
  return (await obtenerBaseDatos().query<{id:string;actaId:string|null;sedeNombre:string;rbd:string|null;comuna:string|null;fecha:string;receptora:string;actor:string;registrado:string;cantidad:number}>(`
    SELECT g.id,(SELECT a.id FROM public.actas_documentos a WHERE a.entrega_id=g.id AND a.pdf IS NOT NULL) AS "actaId",g.sede_nombre AS "sedeNombre",g.sede_rbd AS rbd,g.comuna,g.fecha_entrega::text AS fecha,g.receptor_nombre AS receptora,
      COALESCE(NULLIF(btrim(u.nombre),''),'Funcionario UTIC') AS actor,l.registrado_en::text AS registrado,count(*)::integer AS cantidad
    FROM public.entregas_equipos g JOIN public.entregas_lotes l ON l.id=g.lote_id JOIN public.entregas_detalle d ON d.entrega_id=g.id LEFT JOIN public.usuarios_acceso u ON u.correo=l.actor
    GROUP BY g.id,l.id,COALESCE(NULLIF(btrim(u.nombre),''),'Funcionario UTIC'),l.registrado_en ORDER BY l.registrado_en DESC,g.sede_nombre,g.id LIMIT 100`)).rows;
}
export async function detalleEntrega(id: string) {
  await exigirAdministrador();
  if (!esIdSede(id)) return null;
  const { rows } = await obtenerBaseDatos().query<{id:string;actaId:string|null;sedeNombre:string;rbd:string|null;comuna:string|null;fecha:string;receptora:string;cargo:string;enlace:string|null;actor:string;registrado:string;receptorDatos:{rut?:string;correo?:string};sedeDatos:{direccion?:string;correoInstitucional?:string}}>(`
    SELECT g.id,(SELECT a.id FROM public.actas_documentos a WHERE a.entrega_id=g.id AND a.pdf IS NOT NULL) AS "actaId",g.sede_nombre AS "sedeNombre",g.sede_rbd AS rbd,g.comuna,g.fecha_entrega::text AS fecha,g.receptor_nombre AS receptora,
      g.receptor_cargo AS cargo,g.enlace_acta AS enlace,g.receptor_datos AS "receptorDatos",g.sede_datos AS "sedeDatos",COALESCE(NULLIF(btrim(u.nombre),''),'Funcionario UTIC') AS actor,l.registrado_en::text AS registrado
    FROM public.entregas_equipos g JOIN public.entregas_lotes l ON l.id=g.lote_id LEFT JOIN public.usuarios_acceso u ON u.correo=l.actor WHERE g.id=$1::uuid`,[id]);
  if (!rows[0]) return null;
  const items = (await obtenerBaseDatos().query<{id:string;antes:Record<string,unknown>;despues:Record<string,unknown>}>("SELECT equipo_id AS id,antes,despues FROM public.entregas_detalle WHERE entrega_id=$1::uuid ORDER BY equipo_id",[id])).rows;
  return { ...rows[0], items };
}

export async function resumenLote(id: string) {
  await exigirAdministrador();
  if (!esIdSede(id)) return null;
  return (await obtenerBaseDatos().query<{cantidad:number}>("SELECT cantidad FROM public.entregas_lotes WHERE id=$1::uuid",[id])).rows[0] ?? null;
}
