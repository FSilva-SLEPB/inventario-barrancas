import "server-only";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAcceso } from "@/lib/acceso";
import type { Sede } from "@/lib/validacion-sedes";
import { requiereSede } from "@/lib/politica-acceso";

export async function listarSedes(): Promise<Sede[]> {
  const acceso = await exigirAcceso('insumos');
  const resultado = await obtenerBaseDatos().query<Sede>(`
    SELECT id, tipo, nombre, rbd, direccion, comuna,
           correo_institucional AS "correoInstitucional", activo
    FROM public.sedes
    WHERE ($1::boolean OR id = $2::uuid)
    ORDER BY CASE tipo
               WHEN 'nivel_central' THEN 0
               WHEN 'establecimiento' THEN 1
               ELSE 2
             END,
             lower(nombre), id
  `, [!requiereSede(acceso), acceso.sedeId]);

  return resultado.rows;
}
