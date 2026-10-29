"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { validarUsuario, valoresUsuario, type EstadoUsuario } from "@/lib/validacion-usuarios";

export async function guardarUsuario(_anterior: EstadoUsuario, formulario: FormData): Promise<EstadoUsuario> {
  const actor = await exigirAdministrador();
  const revision = randomUUID();
  if (!(formulario instanceof FormData)) return { resultado: "error", mensaje: "El formulario no es válido.",
    valores: valoresUsuario(), errores: {}, revision };
  const { datos, valores, errores } = validarUsuario(formulario);
  const fallo: EstadoUsuario = { resultado: "error", mensaje: "Corrige los campos indicados.",
    valores, errores, revision };
  if (!datos) return fallo;
  try {
    await obtenerBaseDatos().query(
      "SELECT public.guardar_usuario_acceso($1, $2, $3, $4, $5, $6, $7::uuid)",
      [actor.email, datos.correo, datos.nombre, datos.rol, datos.activo, datos.version, datos.sedeId],
    );
  } catch (error) {
    const codigo = (error as { code?: string } | null)?.code;
    const mensajes: Record<string, string> = {
      "23505": "Este correo ya está registrado. Selecciónalo desde el listado para editarlo.",
      "P1001": "Debe quedar al menos un administrador activo.",
      "P1002": "Otro administrador debe cambiar tu perfil o desactivar tu cuenta.",
      "P1003": "La cuenta fue modificada. Recarga la página antes de guardar.",
      "P1004": "Solo el Administrador del sistema puede gestionar perfiles administrativos.",
      "P1005": "Selecciona una sede EE/JI activa para un perfil local; deja sin sede los perfiles generales.",
      "42501": "Tu permiso de administración cambió. Vuelve a ingresar.",
    };
    if (!codigo || !mensajes[codigo]) console.error("No se pudo guardar el acceso del usuario.");
    return { ...fallo, mensaje: mensajes[codigo ?? ""] ?? "No se pudo guardar. Inténtalo nuevamente." };
  }
  revalidatePath("/mantenedores/usuarios");
  return { resultado: "guardado", mensaje: "Acceso guardado correctamente.", errores: {}, revision,
    valores: datos.version === 0 ? valoresUsuario() : { ...valores, version: String(datos.version + 1) } };
}
