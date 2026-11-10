import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { opcionesAuth } from "@/lib/opciones-auth";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";
import { puedeAdministrar, puedeGestionarDependencias, requiereSede, rolValido } from "@/lib/politica-acceso";
import { obtenerBaseDatos } from "@/lib/db";

const correoRevision = () => {
  const v = process.env.REVISION_SIN_OAUTH?.trim();
  if (!v || v === "0" || v.toLowerCase() === "false") return null;
  if (v === "1" || v.toLowerCase() === "true") return "felipe.silva@slepb.gob.cl";
  return v.toLowerCase();
};

async function accesoRevision() {
  const correo = correoRevision();
  if (!correo) return null;
  const { rows } = await obtenerBaseDatos().query<{
    rol: unknown; sedeId: string | null; sedeNombre: string | null; sedeRbd: string | null;
  }>(
    `SELECT u.rol, u.sede_id AS "sedeId", s.nombre AS "sedeNombre", s.rbd AS "sedeRbd"
     FROM public.usuarios_acceso u LEFT JOIN public.sedes s ON s.id = u.sede_id
     WHERE u.correo = $1 AND u.activo
       AND (u.rol NOT IN ('encargado', 'consulta_sede')
            OR (s.activo AND s.tipo IN ('establecimiento', 'jardin_infantil')))`,
    [correo],
  );
  const fila = rows[0];
  if (!rolValido(fila?.rol) || (requiereSede(fila.rol) && !fila.sedeId)) return null;
  return { email: correo, rol: fila.rol, sedeId: fila.sedeId ?? null, sedeNombre: fila.sedeNombre ?? null, sedeRbd: fila.sedeRbd ?? null };
}

// React cache dura una petición de renderizado; no conserva permisos entre usuarios.
export const obtenerSesion = cache(async () => {
  if (correoRevision()) return null;
  if (!autenticacionConfigurada()) return null;
  return getServerSession(opcionesAuth);
});

export const obtenerAcceso = cache(async () => {
  const revision = await accesoRevision();
  if (revision) return revision;
  const sesion = await obtenerSesion();
  return sesion?.user ?? null;
});

export async function exigirAcceso() {
  const acceso = await obtenerAcceso();
  if (!acceso) {
    const sesion = await obtenerSesion();
    redirect(sesion?.accesoDenegado ? "/acceso-denegado" : "/ingresar");
  }
  return acceso;
}

export async function exigirAdministrador() {
  const acceso = await exigirAcceso();
  if (!puedeAdministrar(acceso.rol)) redirect("/sin-permiso");
  return acceso;
}

export async function exigirGestionDependencias() {
  const acceso = await exigirAcceso();
  if (!puedeGestionarDependencias(acceso.rol)) redirect("/sin-permiso");
  return acceso;
}
