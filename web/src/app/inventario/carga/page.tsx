import { redirect } from "next/navigation";
import { exigirAdministrador } from "@/lib/acceso";

export default async function CargaEquipos() {
  await exigirAdministrador();
  redirect("/inventario/registro#carga-masiva");
}
