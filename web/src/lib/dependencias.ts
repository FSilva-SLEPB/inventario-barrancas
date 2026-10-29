import "server-only";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAcceso } from "@/lib/acceso";
import type { Dependencia } from "@/lib/validacion-dependencias";
import type { TipoSede } from "@/lib/validacion-sedes";
import { requiereSede } from "@/lib/politica-acceso";

export type DependenciaListado = Dependencia & {
  sedeNombre: string;
  sedeTipo: TipoSede;
  sedeRbd: string | null;
  sedeActiva: boolean;
};

export async function listarDependencias(): Promise<DependenciaListado[]> {
  const acceso = await exigirAcceso();
  const resultado = await obtenerBaseDatos().query<DependenciaListado>(`
    SELECT d.id, d.sede_id AS "sedeId", d.nombre, d.activo,
           s.nombre AS "sedeNombre", s.tipo AS "sedeTipo",
           s.rbd AS "sedeRbd", s.activo AS "sedeActiva"
    FROM public.dependencias AS d
    JOIN public.sedes AS s ON s.id = d.sede_id
    WHERE ($1::boolean OR d.sede_id = $2::uuid)
    ORDER BY lower(s.nombre), s.id, lower(d.nombre), d.id
  `, [!requiereSede(acceso.rol), acceso.sedeId]);

  return resultado.rows;
}
