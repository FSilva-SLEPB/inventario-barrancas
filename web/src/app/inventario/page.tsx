import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar, requiereSede } from "@/lib/politica-acceso";
import type { ParametrosInventario } from "@/components/vista-inventario";
import styles from "./inventario.module.css";

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
  const gestionar = puedeAdministrar(actor.rol);
  return <main>
    <header><h1>Inventario</h1><p className="descripcion-pagina">Consulta los equipos de Nivel Central y de los establecimientos/JISC. Los registros conservan su identificación e historial; los pendientes de entrega se mantienen separados de los recibidos.</p></header>
    <section aria-labelledby="accesos-inventario"><h2 id="accesos-inventario">Accesos de inventario</h2>
    <div className={styles.accesos}>
      <Link className={styles.acceso} href="/inventario/nivel-central">
        <span className={styles.accesoIcono} aria-hidden="true">NC</span>
        <h2>Inventario Nivel Central</h2><p>Equipos y bienes de Nivel Central.</p><strong>Entrar al inventario →</strong>
      </Link>
      <Link className={styles.acceso} href="/inventario/p02">
        <span className={styles.accesoIcono} aria-hidden="true">P02</span>
        <h2>Inventario P02</h2><p>Establecimientos educacionales, jardines infantiles y salas cunas.</p><strong>Entrar al inventario →</strong>
      </Link>
      {gestionar && <>
        <Link className={styles.acceso} href="/inventario/registro">
          <span className={styles.accesoIcono} aria-hidden="true">+</span>
          <h2>Registro de equipos</h2><p>Registrar equipos para Nivel Central o establecimientos/JISC y revisar la carga masiva.</p><strong>Ir al registro →</strong>
        </Link>
        <Link className={styles.acceso} href="/inventario/bodega-ti">
          <span className={styles.accesoIcono} aria-hidden="true">TI</span>
          <h2>Bodega TI</h2><p>Consultar equipos pendientes de entrega a establecimientos, jardines infantiles y salas cunas.</p><strong>Entrar a Bodega TI →</strong>
        </Link>
        <Link className={styles.acceso} href="/inventario/movimientos">
          <span className={styles.accesoIcono} aria-hidden="true">↔</span>
          <h2>Movimientos y actas</h2><p>Consultar entregas y sus antecedentes, con fecha, receptora e historial.</p><strong>Ver movimientos →</strong>
        </Link>
      </>}
      <Link className={styles.acceso} href="/inventario/robos"><span className={styles.accesoIcono} aria-hidden="true">!</span><h2>Consolidado de robos</h2><p>Equipos reportados, robos validados y recuperaciones por sede.</p><strong>Consultar consolidado →</strong></Link>
    </div></section>
  </main>;
}
