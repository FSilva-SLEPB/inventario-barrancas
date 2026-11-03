import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { requiereSede } from "@/lib/politica-acceso";
import type { ParametrosInventario } from "@/components/vista-inventario";
import PortadaModulo from "@/components/portada-modulo";
import { modulosSistema } from "@/lib/modulos";

export const metadata = { title: "Inventario | SLEP Barrancas" };

export default async function Inventario({ searchParams }: ParametrosInventario) {
  const actor = await exigirAcceso();
  const p = await searchParams;
  const local = requiereSede(actor.rol);
  const claves = ["vista", "q", "pagina", "tipo", "sede", "rbd", "limite"];
  // Conservar los enlaces anteriores sin volver a mezclar las dos páginas.
  if (local || typeof p.ambito === "string" || claves.some(k => typeof p[k] === "string")) {
    const ruta = !local && p.ambito === "nc" ? "/inventario/nivel-central" : "/inventario/p02";
    const parametros = new URLSearchParams();
    for (const clave of claves) if (typeof p[clave] === "string") parametros.set(clave, p[clave]);
    redirect(ruta + (parametros.size ? `?${parametros}` : ""));
  }
  return <PortadaModulo modulo={modulosSistema(actor.rol).find(m=>m.id==='inventario')!}/>;
}
