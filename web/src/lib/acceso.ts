import "server-only";
import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { opcionesAuth } from "@/lib/opciones-auth";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";
import { puedeAdministrar, puedeGestionarDependencias, puedeGestionarInsumos } from "@/lib/politica-acceso";

// React cache dura una petición de renderizado; no conserva permisos entre usuarios.
export const obtenerSesion = cache(async () => {
  if (!autenticacionConfigurada()) return null;
  return getServerSession(opcionesAuth);
});

export const obtenerAcceso = cache(async () => {
  const sesion = await obtenerSesion();
  return sesion?.user ?? null;
});

// Los módulos existentes mantienen su alcance. El gestor solo entra por Insumos.
export async function exigirAcceso(ambito:'general'|'insumos'='general') {
  const acceso = await obtenerAcceso();
  if (!acceso) {
    const sesion = await obtenerSesion();
    redirect(sesion?.accesoDenegado ? "/acceso-denegado" : "/ingresar");
  }
  if(acceso.rol==='gestor_insumos'&&ambito!=='insumos')redirect('/sin-permiso');
  return acceso;
}

export async function exigirGestionInsumos(){
 const acceso=await exigirAcceso('insumos');
 if(!puedeGestionarInsumos(acceso.rol))redirect('/sin-permiso');
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
