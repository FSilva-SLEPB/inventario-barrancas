import "server-only";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import type { UsuarioAcceso } from "@/lib/validacion-usuarios";

export async function listarUsuarios(): Promise<UsuarioAcceso[]> {
  await exigirAdministrador();
  const { rows } = await obtenerBaseDatos().query<UsuarioAcceso>(
    "SELECT correo, nombre, rol, activo, version FROM public.usuarios_acceso ORDER BY correo",
  );
  return rows;
}
