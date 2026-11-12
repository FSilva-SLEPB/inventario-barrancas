import "server-only";
import { exigirPermiso } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import type { UsuarioAcceso } from "@/lib/validacion-usuarios";

export async function listarUsuarios(): Promise<UsuarioAcceso[]> {
  const actor=await exigirPermiso('usuarios_operativos','consultar');
  const { rows } = await obtenerBaseDatos().query<UsuarioAcceso>(
    `SELECT u.correo, u.nombre, u.rol, u.activo, u.version, u.sede_id AS "sedeId",u.perfil_id,u.alcance_rbac,u.funcionario_id,p.nombre AS "perfilNombre",p.clase AS "clasePerfil",p.activo AS "perfilActivo"
     FROM public.usuarios_acceso u LEFT JOIN public.rbac_perfiles p ON p.id=u.perfil_id WHERE ($1::boolean OR (u.rol NOT IN ('administrador','administrador_gestion') AND COALESCE(p.clase,'operativo') NOT IN ('sistema','utic'))) AND ($2::boolean OR u.sede_id=$3::uuid) ORDER BY u.correo`,[actor.clasePerfil==='sistema',actor.alcance==='global',actor.sedeId],
  );
  return rows;
}
