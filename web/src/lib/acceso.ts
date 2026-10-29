import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { opcionesAuth } from "@/lib/opciones-auth";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";
import { puedeAdministrar } from "@/lib/politica-acceso";

// React cache dura una petición de renderizado; no conserva permisos entre usuarios.
export const obtenerSesion = cache(async () => {
  if (!autenticacionConfigurada()) return null;
  return getServerSession(opcionesAuth);
});

export const obtenerAcceso = cache(async () => {
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
