"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirGestionDependencias } from "@/lib/acceso";
import {
  validarDependencia,
  valoresInicialesDependencia,
  type EstadoDependencia,
} from "@/lib/validacion-dependencias";

export async function guardarDependencia(
  _anterior: EstadoDependencia,
  formulario: FormData,
): Promise<EstadoDependencia> {
  const actor = await exigirGestionDependencias();
  const revision = randomUUID();

  if (!(formulario instanceof FormData)) {
    return {
      resultado: "error", mensaje: "El formulario no es válido. Recarga la página.",
      revision, valores: valoresInicialesDependencia(), errores: {},
    };
  }

  const { valores, errores, datos } = validarDependencia(formulario);
  const respuesta: EstadoDependencia = {
    resultado: "error", mensaje: "Corrige los campos indicados.",
    revision, valores, errores,
  };

  if (!datos) {
    return { ...respuesta, mensaje: errores.id ?? respuesta.mensaje };
  }

  try {
    const base = obtenerBaseDatos();
    await base.query("SELECT public.guardar_dependencia_acceso($1,$2::uuid,$3::uuid,$4,$5)",
      [actor.email, datos.id, datos.sedeId, datos.nombre, datos.activo]);
  } catch (error: unknown) {
    const errorBase = error as { code?: string; constraint?: string } | null;
    if (errorBase?.code === "42501") return { ...respuesta,
      mensaje: "No tienes permiso para modificar esta dependencia o sede." };
    if (errorBase?.code === "P1006") return { ...respuesta,
      mensaje: "La dependencia ya no está disponible. Recarga el listado." };
    if (errorBase?.code === "23505"
        && errorBase.constraint === "dependencias_sede_nombre_unico") {
      return {
        ...respuesta,
        mensaje: "Ya existe una dependencia con ese nombre en la sede seleccionada.",
        errores: { nombre: "Usa otro nombre o edita la dependencia que ya está registrada." },
      };
    }
    if (errorBase?.code === "23503" && errorBase.constraint === "dependencias_sede_id_fkey") {
      return {
        ...respuesta,
        mensaje: "La sede seleccionada ya no está disponible.",
        errores: { sedeId: "Selecciona una sede del listado. Si es necesario, recarga la página." },
      };
    }
    console.error("No fue posible guardar una dependencia.", { codigo: errorBase?.code });
    return {
      ...respuesta,
      mensaje: "No fue posible guardar la dependencia. Inténtalo nuevamente.",
    };
  }

  revalidatePath("/mantenedores/dependencias");

  return {
    resultado: "guardado",
    mensaje: datos.id ? "Cambios guardados correctamente." : "Dependencia creada correctamente.",
    revision,
    valores: datos.id ? valores : { ...valoresInicialesDependencia(), sedeId: datos.sedeId },
    errores: {},
  };
}
