import "server-only";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import type { UsuarioAcceso } from "@/lib/validacion-usuarios";

export async function listarUsuarios(): Promise<UsuarioAcceso[]> {
  await exigirAdministrador();
  const { rows } = await obtenerBaseDatos().query<UsuarioAcceso>(
    `SELECT u.correo, u.nombre, u.rol, u.activo, u.version, u.sede_id AS "sedeId"
     FROM public.usuarios_acceso u ORDER BY u.correo`,
  );
  return rows;
}
