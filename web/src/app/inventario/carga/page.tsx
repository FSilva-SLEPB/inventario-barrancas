import { redirect } from "next/navigation";
import { exigirPermiso } from "@/lib/acceso";

export default async function CargaEquipos() {
  const actor=await exigirPermiso('equipos','registrar');if(actor.alcance&&actor.alcance!=='global')redirect('/sin-permiso');
  redirect("/inventario/registro?carga=1#carga-masiva");
}
