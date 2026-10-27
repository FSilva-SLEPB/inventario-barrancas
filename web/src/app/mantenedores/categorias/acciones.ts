"use server";

import { revalidatePath } from "next/cache";

import { obtenerBaseDatos } from "@/lib/db";

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
  if (process.env.NODE_ENV !== "development") {
    return {
      resultado: "error",
      mensaje: "El guardado no está disponible.",
      nombre: "",
      activo: "true",
    };
  }

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
    const resultado = id
      ? await db.query(
          "UPDATE public.categorias_bienes SET nombre = $1, activo = $2 WHERE id = $3",
          [nombre, activo === "true", id],
        )
      : await db.query(
          "INSERT INTO public.categorias_bienes (nombre, activo) VALUES ($1, $2)",
          [nombre, activo === "true"],
        );

    if (resultado.rowCount !== 1) {
      return fallo("La categoría ya no está disponible. Recarga la página.");
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

  return {
    resultado: "guardado",
    mensaje: id ? "Cambios guardados." : "Categoría creada.",
    nombre: id ? nombre : "",
    activo: id ? valores.activo : "true",
  };
}
