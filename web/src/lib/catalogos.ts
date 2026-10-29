import "server-only";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAcceso } from "@/lib/acceso";

export type CategoriaBien = {
  id: string;
  nombre: string;
  activo: boolean;
};

export async function listarCategorias(): Promise<CategoriaBien[]> {
  await exigirAcceso();
  const resultado = await obtenerBaseDatos().query<CategoriaBien>(`
    SELECT id, nombre, activo
    FROM public.categorias_bienes
    ORDER BY lower(nombre), id
  `);

  return resultado.rows;
}
