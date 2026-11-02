import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { requiereSede } from "@/lib/politica-acceso";
import type { ParametrosInventario } from "@/components/vista-inventario";
import styles from "./inventario.module.css";

export const metadata = { title: "Inventario | SLEP Barrancas" };

export default async function Inventario({ searchParams }: ParametrosInventario) {
  const actor = await exigirAcceso();
  const p = await searchParams;
  const local = requiereSede(actor.rol);
  const claves = ["vista", "q", "pagina", "tipo", "sede", "rbd"];
  // Conservar los enlaces anteriores sin volver a mezclar las dos páginas.
  if (local || typeof p.ambito === "string" || claves.some(k => typeof p[k] === "string")) {
    const ruta = !local && p.ambito === "nc" ? "/inventario/nivel-central" : "/inventario/p02";
    const parametros = new URLSearchParams();
    for (const clave of claves) if (typeof p[clave] === "string") parametros.set(clave, p[clave]);
    redirect(ruta + (parametros.size ? `?${parametros}` : ""));
  }
  return <main>
    <header><h1>Inventario</h1><p className="descripcion-pagina">Selecciona el inventario que necesitas consultar.</p></header>
    <div className={styles.accesos}>
      <Link className={styles.acceso} href="/inventario/nivel-central">
        <span className={styles.accesoIcono} aria-hidden="true">NC</span>
        <h2>Inventario Nivel Central</h2><p>Equipos y bienes de Nivel Central.</p><strong>Entrar al inventario →</strong>
      </Link>
      <Link className={styles.acceso} href="/inventario/p02">
        <span className={styles.accesoIcono} aria-hidden="true">P02</span>
        <h2>Inventario P02</h2><p>Establecimientos educacionales, jardines infantiles y salas cunas.</p><strong>Entrar al inventario →</strong>
      </Link>
    </div>
  </main>;
}
