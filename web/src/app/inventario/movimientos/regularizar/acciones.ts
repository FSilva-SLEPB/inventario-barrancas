"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { validarRegularizacion } from "@/lib/validacion-entregas";
export type EstadoRegularizacion = { estado: "inicial" | "error"; mensaje: string; valores: Record<string,string> };

export async function regularizarEntregas(_anterior: EstadoRegularizacion, f: FormData): Promise<EstadoRegularizacion> {
  const actor = await exigirAdministrador();
  const valores: Record<string,string> = {};
  f.forEach((v,k) => { if (typeof v === "string" && /^(fecha|receptora|acta)-[a-f0-9-]{36}$/i.test(k)) valores[k]=v.slice(0,1500); });
  let datos: ReturnType<typeof validarRegularizacion>;
  try { datos = validarRegularizacion(f); } catch (e) {
    return { estado: "error", mensaje: e instanceof Error ? e.message : "Revisa el formulario.", valores };
  }
  try {
    await obtenerBaseDatos().query(
      "SELECT public.regularizar_entregas_acceso($1,$2::uuid,$3::jsonb)",[actor.email,datos.solicitud,JSON.stringify(datos.grupos)]);
  } catch (e) {
    const codigo = (e as {code?:string})?.code;
    const mensajes: Record<string,string> = { "42501":"Tu cuenta ya no tiene permiso para confirmar entregas.",
      P2101:"Revisa los jardines: deben estar activos y no repetirse.",P2102:"Algún equipo cambió o ya fue entregado. No se guardó ninguna entrega; vuelve a Bodega TI y revisa la selección.",
      P2302:"Algún equipo tiene un incidente de robo abierto. Revisa la selección; no se guardaron entregas.",P2103:"La solicitud ya se utilizó con otros datos. Vuelve a revisar la selección desde Bodega TI.","22023":"Revisa fechas, directoras y equipos seleccionados." };
    if (!codigo || !mensajes[codigo]) console.error("No se pudo regularizar la entrega.");
    return { estado: "error", mensaje: mensajes[codigo??""] ?? "No se pudo confirmar la regularización. No se guardaron cambios parciales.", valores };
  }
  revalidatePath("/inventario", "layout");
  redirect(`/inventario/movimientos?lote=${datos.solicitud}`);
}
