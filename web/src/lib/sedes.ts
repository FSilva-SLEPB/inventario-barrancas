import "server-only";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAcceso } from "@/lib/acceso";
import type { Sede } from "@/lib/validacion-sedes";

export async function listarSedes(): Promise<Sede[]> {
  await exigirAcceso();
  const resultado = await obtenerBaseDatos().query<Sede>(`
    SELECT id, tipo, nombre, rbd, direccion, comuna,
           correo_institucional AS "correoInstitucional", activo
    FROM public.sedes
    ORDER BY CASE tipo
               WHEN 'nivel_central' THEN 0
               WHEN 'establecimiento' THEN 1
               ELSE 2
             END,
             lower(nombre), id
  `);

  return resultado.rows;
}
