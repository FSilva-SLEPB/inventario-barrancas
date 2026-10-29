import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { opcionesAuth } from "@/lib/opciones-auth";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";
import { puedeAdministrar } from "@/lib/politica-acceso";

// React cache dura una petición de renderizado; no conserva permisos entre usuarios.
export const obtenerAcceso = cache(async () => {
  if (!autenticacionConfigurada()) return null;
  const sesion = await getServerSession(opcionesAuth);
  return sesion?.user ?? null;
});

export async function exigirAcceso() {
  const acceso = await obtenerAcceso();
  if (!acceso) redirect("/ingresar");
  return acceso;
}

export async function exigirAdministrador() {
  const acceso = await exigirAcceso();
  if (!puedeAdministrar(acceso.rol)) redirect("/sin-permiso");
  return acceso;
}
