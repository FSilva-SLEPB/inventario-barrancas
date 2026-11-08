"use server";
import {destinoConExito} from '@/lib/aviso-exito';

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAdministrador } from "@/lib/acceso";

export type EstadoCategoria = {
  resultado: "inicial" | "error" | "guardado";
  mensaje: string;
  nombre: string;
  activo: "true" | "false";
  errorNombre?: string;
};

export async function guardarCategoria(
  _estadoAnterior: EstadoCategoria,
  datos: FormData,
): Promise<EstadoCategoria> {
  const actor = await exigirAdministrador();

  const id = datos.get("id");
  const nombreRecibido = datos.get("nombre");
  const activo = datos.get("activo");
  const nombre = typeof nombreRecibido === "string"
    ? nombreRecibido.normalize("NFC").trim().replace(/\s+/gu, " ")
    : "";

  const valores: Pick<EstadoCategoria, "nombre" | "activo"> = {
    nombre,
    activo: activo === "false" ? "false" : "true",
  };

  const fallo = (mensaje: string, errorNombre?: string): EstadoCategoria => ({
    ...valores,
    resultado: "error",
    mensaje,
    ...(errorNombre ? { errorNombre } : {}),
  });

  if (
    typeof id !== "string"
    || (id !== "" && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(id))
    || (activo !== "true" && activo !== "false")
  ) {
    return fallo("Los datos recibidos no son válidos. Recarga la página.");
  }

  if (!nombre || nombre.length > 100 || /\p{Cc}/u.test(nombre)) {
    const mensaje = "Escribe un nombre de entre 1 y 100 caracteres.";
    return fallo(mensaje, mensaje);
  }

  try {
    const db = obtenerBaseDatos();
    if (id) {
      await db.query(
        "SELECT public.guardar_categoria_acceso($1, $2::uuid, $3, $4)",
        [actor.email, id, nombre, activo === "true"],
      );
    } else {
      await db.query(
        "SELECT public.guardar_categoria_acceso($1, NULL::uuid, $3, $4)",
        [actor.email, nombre, activo === "true"],
      );
    }
  } catch (error) {
    const codigo = typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

    if (codigo === "23505") {
      const mensaje = "Ya existe una categoría con ese nombre, activa o inactiva.";
      return fallo(mensaje, mensaje);
    }

    console.error("No se pudo guardar una categoría.");
    return fallo("No pudimos guardar los cambios. Inténtalo nuevamente.");
  }

  revalidatePath("/mantenedores/categorias");
  if (id) redirect(destinoConExito("/mantenedores/categorias?guardado=1"));

  return {
    resultado: "guardado",
    mensaje: id ? "Cambios guardados." : "Categoría creada.",
    nombre: id ? nombre : "",
    activo: id ? valores.activo : "true",
  };
}
