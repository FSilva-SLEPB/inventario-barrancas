"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirGestionDependencias } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { validarEquipo, valoresEquipo, type EstadoEquipo } from "@/lib/validacion-equipos";
export async function guardarEquipo(_anterior:EstadoEquipo,formulario:FormData):Promise<EstadoEquipo> {
  const actor=await exigirGestionDependencias();const revision=randomUUID();
  const {datos,valores,errores}=validarEquipo(formulario);
  const fallo:EstadoEquipo={resultado:"error",mensaje:"Revisa los campos indicados.",valores,errores,revision};
  if(!datos)return fallo;
  try {
    await obtenerBaseDatos().query("SELECT public.guardar_equipo_acceso($1,$2::jsonb,$3,$4)",
      [actor.email,JSON.stringify(datos),Number(valores.version),datos.id ? valores.motivoCambio : "Registro inicial"]);
  } catch(error) {
    const mensajes:Record<string,string>={"23505":"La serie o el número de inventario ya está registrado. No se guardó el equipo.",
      "42501":"No tienes permiso para modificar este equipo o sede.",P2001:"La sede o categoría no está disponible.",
      P2002:"El equipo cambió. Recarga su ficha antes de guardar.",P2003:"El cambio de inventario requiere un traspaso documentado."};
    const codigo=(error as {code?:string})?.code??"";
    if(!mensajes[codigo])console.error("No se pudo guardar el equipo.");
    return {...fallo,mensaje:mensajes[codigo]??"No se pudo guardar el equipo. Revisa los datos e inténtalo nuevamente."};
  }
  revalidatePath("/inventario", "layout");
  return {resultado:"guardado",mensaje:"Equipo guardado con su historial.",errores:{},revision,
    valores:datos.id ? {...valores,version:String(Number(valores.version)+1),motivoCambio:""}
      : {...valoresEquipo(),sedeId:actor.rol==="encargado"?actor.sedeId??"":"",origen:actor.rol==="encargado"?"compra_sede":"compra_utic"}};
}
