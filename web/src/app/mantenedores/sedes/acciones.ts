"use server";
import {destinoConExito} from '@/lib/aviso-exito';

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { obtenerBaseDatos } from "@/lib/db";
import { exigirAdministrador } from "@/lib/acceso";
import {
  validarSede,
  valoresInicialesSede,
  type EstadoSede,
} from "@/lib/validacion-sedes";

export async function guardarSede(
  _anterior: EstadoSede,
  formulario: FormData,
): Promise<EstadoSede> {
  const actor = await exigirAdministrador();
  const revision = randomUUID();
  const { valores, errores, datos } = validarSede(formulario);
  const respuesta: EstadoSede = {
    resultado: "error",
    mensaje: "Corrige los campos indicados.",
    revision,
    valores,
    errores,
  };

  if (!datos) {
    return { ...respuesta, mensaje: errores.id ?? respuesta.mensaje };
  }

  try {
    const base = obtenerBaseDatos();
    await base.query("SELECT public.guardar_sede_acceso($1, $2::uuid, $3::jsonb)", [
      actor.email,
      datos.id,
      JSON.stringify({
        tipo: datos.tipo,
        nombre: datos.nombre,
        rbd: datos.rbd,
        direccion: datos.direccion,
        comuna: datos.comuna,
        correoInstitucional: datos.correoInstitucional,
        activo: datos.activo,
      }),
    ]);
  } catch (error: unknown) {
    const errorBase = error as { code?: string; constraint?: string } | null;
    if (errorBase?.code === "23505" && errorBase.constraint === "sedes_rbd_key") {
      return {
        ...respuesta,
        mensaje: "Ya existe una sede con ese RBD.",
        errores: { rbd: "Este RBD ya está registrado. Revisa el listado de sedes." },
      };
    }
    if (errorBase?.code === "P1006") {
      return {
        ...respuesta,
        mensaje: "La sede ya no está disponible. Vuelve al listado y selecciónala nuevamente.",
      };
    }
    if (errorBase?.code === "42501") {
      return {
        ...respuesta,
        mensaje: "No tienes permiso para modificar esta sede.",
      };
    }
    console.error("No fue posible guardar una sede.", { codigo: errorBase?.code });
    return {
      ...respuesta,
      mensaje: "No fue posible guardar la sede. Inténtalo nuevamente.",
    };
  }

  revalidatePath("/mantenedores/sedes");
  revalidatePath("/directorio", "layout");
  revalidatePath("/inventario", "layout");
  if (datos.id) redirect(destinoConExito("/mantenedores/sedes?guardado=1"));

  return {
    resultado: "guardado",
    mensaje: datos.id ? "Cambios guardados correctamente." : "Sede creada correctamente.",
    revision,
    valores: datos.id ? valores : valoresInicialesSede(),
    errores: {},
  };
}
