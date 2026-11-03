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
  await exigirAdministrador();
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
    const parametros = [
      datos.tipo, datos.nombre, datos.rbd, datos.direccion,
      datos.comuna, datos.correoInstitucional, datos.activo,
    ];
    const base = obtenerBaseDatos();

    if (datos.id) {
      const resultado = await base.query(`
        UPDATE public.sedes
        SET tipo = $1, nombre = $2, rbd = $3, direccion = $4,
            comuna = $5, correo_institucional = $6, activo = $7
        WHERE id = $8::uuid
      `, [...parametros, datos.id]);

      if (resultado.rowCount !== 1) {
        return {
          ...respuesta,
          mensaje: "La sede ya no está disponible. Vuelve al listado y selecciónala nuevamente.",
        };
      }
    } else {
      await base.query(`
        INSERT INTO public.sedes
          (tipo, nombre, rbd, direccion, comuna, correo_institucional, activo)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, parametros);
    }
  } catch (error: unknown) {
    const errorBase = error as { code?: string; constraint?: string } | null;
    if (errorBase?.code === "23505" && errorBase.constraint === "sedes_rbd_key") {
      return {
        ...respuesta,
        mensaje: "Ya existe una sede con ese RBD.",
        errores: { rbd: "Este RBD ya está registrado. Revisa el listado de sedes." },
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
