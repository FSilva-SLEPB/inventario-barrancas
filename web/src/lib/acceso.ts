import {permisoRuta} from '@/lib/rbac-rutas';
import {esAutorizacionRbac,tienePermiso} from '@/lib/rbac';
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
  if(esAutorizacionRbac(acceso)){
   const ruta=(await (await import('next/headers')).headers()).get('x-inventario-ruta')??'',permiso=permisoRuta(ruta);
   const familias:Record<string,string[]>={'/inventario':['equipos','celulares','bodega','actas','prestamos','incidentes'],'/insumos':['solicitudes_insumos','seguimiento_insumos','historial_insumos'],'/directorio':['directorio_institucional','directorio_personas'],'/mantenedores':['usuarios_operativos','perfiles','funcionarios','categorias','sedes','dependencias','catalogo_insumos']};
   if(familias[ruta]&&!familias[ruta].some(r=>tienePermiso(acceso,r)||tienePermiso(acceso,r,'registrar')))redirect('/sin-permiso');
   const acta=ruta.startsWith('/inventario/actas/');
   if(permiso&&!acceso.permisos.includes(permiso)&&!(acta&&tienePermiso(acceso,'actas_insumos')))redirect('/sin-permiso');
   return acceso;
  }
  if(acceso.rol==='gestor_insumos'&&ambito!=='insumos')redirect('/sin-permiso');
  return acceso;
}

export async function exigirGestionInsumos(){
 const acceso=await exigirAcceso('insumos');
 if(!puedeGestionarInsumos(acceso))redirect('/sin-permiso');
 return acceso;
}

export async function exigirAdministrador() {
  const acceso = await exigirAcceso();
  if (!puedeAdministrar(acceso)) redirect("/sin-permiso");
  return acceso;
}

export async function exigirGestionDependencias() {
  const acceso = await exigirAcceso();
  if (!puedeGestionarDependencias(acceso)&&!(esAutorizacionRbac(acceso)&&tienePermiso(acceso,'equipos','registrar'))) redirect("/sin-permiso");
  return acceso;
}

export async function exigirPermiso(recurso:string,accion='consultar'){
 const actor=await exigirAcceso();if(!tienePermiso(actor,recurso,accion))redirect('/sin-permiso');return actor;
}

export async function exigirAlguno(...permisos:string[]){
 const actor=await exigirAcceso();if(!permisos.some(p=>actor.permisos?.includes(p)))redirect('/sin-permiso');return actor;
}
