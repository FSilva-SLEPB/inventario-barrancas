import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { listarEquipos } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { puedeAdministrar, puedeGestionarDependencias, requiereSede } from "@/lib/politica-acceso";
import { CONDICIONES, SITUACIONES } from "@/lib/validacion-equipos";
import FiltrosInventario, { RegistrosPorPagina } from "@/components/filtros-inventario";
import { esIdSede } from "@/lib/validacion-sedes";
import styles from "@/app/inventario/inventario.module.css";

export type ParametrosInventario = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function VistaInventario({ searchParams, ambito, bodega = false }: ParametrosInventario & { ambito: "nc" | "eeji"; bodega?: boolean }) {
  const actor = await exigirAcceso();
  const p = await searchParams;
  const local = requiereSede(actor.rol);
  if (bodega && !puedeAdministrar(actor.rol)) redirect("/sin-permiso");
  if (local && ambito === "nc") redirect("/sin-permiso");
  const ruta = bodega ? "/inventario/bodega-ti" : ambito === "nc" ? "/inventario/nivel-central" : "/inventario/p02";
  const vista = bodega ? "pendientes" : ambito === "eeji" && p.vista === "pendientes" ? "pendientes" : "inventario";
  const q = typeof p.q === "string" ? p.q.trim().slice(0, 120) : "";
  const numero = typeof p.pagina === "string" && /^\d{1,7}$/.test(p.pagina) ? Math.max(1, Number(p.pagina)) : 1;
  const tipo = !local && ambito === "eeji" && ["establecimiento", "jardin_infantil"].includes(String(p.tipo)) ? String(p.tipo) : "";
  const sedeId = tipo && !local && ambito === "eeji" && typeof p.sede === "string" && esIdSede(p.sede) ? p.sede : null;
  const rbd = tipo && !local && ambito === "eeji" && typeof p.rbd === "string" ? p.rbd.trim().slice(0, 120) : "";
  const limite = typeof p.limite === "string" && ["50", "100", "150"].includes(p.limite) ? Number(p.limite) : 50;
  const [{ equipos, total, pagina }, sedes] = await Promise.all([
    listarEquipos(ambito, vista, numero, q, tipo, sedeId, rbd, limite),
    listarSedes(),
  ]);
  const sedesAmbito = sedes.filter(s => ambito === "nc" ? s.tipo === "nivel_central" : s.tipo !== "nivel_central");
  const sedesFiltro = sedesAmbito.filter(s => local || s.tipo === tipo);
  const url = (v: string, n = 1) => `${ruta}?${new URLSearchParams({
    vista: v, q, pagina: String(n), tipo, sede: sedeId ?? "", rbd, limite: String(limite),
  })}`;
  const titulo = bodega ? "Bodega TI" : ambito === "nc" ? "Inventario Nivel Central" : "Inventario P02";
  const paginas = Math.max(1, Math.ceil(total / limite));

  return <main className={styles.inventario}>
    <div className={styles.cabecera}>
      <div><p className={styles.etiqueta}>Gestión de inventario</p><h1>{titulo}</h1>
        <p className={styles.descripcion}>{bodega ? "Equipos pendientes de entrega a establecimientos, jardines infantiles y salas cunas" : local ? "Inventario de mi sede" : ambito === "nc" ? "Equipos de Nivel Central" : "Establecimientos educacionales, jardines infantiles y salas cunas"}</p>
      </div>
      <div className={styles.herramientas}>
        <Link className="btn btn-outline-primary btn-sm" href="/inventario">Volver a Inventario</Link>
        {puedeGestionarDependencias(actor.rol) && <Link className="btn btn-outline-primary btn-sm" href="/inventario/registro">Ir al registro</Link>}
      </div>
    </div>
    {vista === "pendientes" && <p className={styles.aviso}>Estos equipos están destinados a la sede y aún no forman parte de su inventario recibido.</p>}
    <FiltrosInventario key={JSON.stringify([ambito, vista, tipo, sedeId, rbd, q, limite])}
      {...{ ambito, vista, local, tipo, rbd, q, limite, bodega }} sedeId={sedeId ?? ""} sedes={sedesFiltro} />
    <section className={styles.resultados} aria-label="Equipos del inventario">
    <div className={styles.resumen}>
      <p><strong>{total.toLocaleString("es-CL")}</strong> equipos {vista === "pendientes" ? "pendientes de entrega" : "registrados / recibidos"}</p>
      <RegistrosPorPagina key={limite} ruta={ruta} limite={limite} filtros={{ vista, tipo, sede: sedeId ?? "", rbd, q }} />
    </div>
    <div className={styles.contenedorTabla} role="region" aria-label="Resultados del inventario" tabIndex={0}>
      <table className={`${styles.tabla} ${ambito === "eeji" ? styles.tablaP02 : styles.tablaCentral}`}>
        <caption className="visually-hidden">{titulo}: {vista === "pendientes" ? "pendientes de entrega" : "equipos registrados / recibidos"}</caption>
        <thead><tr>
          {ambito === "eeji" && <><th scope="col">RBD</th><th scope="col">Establecimiento / JISC</th></>}
          <th scope="col">Equipo</th><th scope="col">Modelo</th><th scope="col">N.º de serie</th>
          <th scope="col">N.º de inventario</th><th scope="col">Estado</th><th scope="col">Historial</th>
        </tr></thead>
        <tbody>{equipos.map(e => <tr key={e.id}>
          {ambito === "eeji" && <><td>{e.sedeRbd || "Sin RBD"}</td><td>{e.sedeNombre}</td></>}
          <td>{e.categoriaNombre}</td><td><span>{e.modelo}</span><small>{e.marca}</small></td>
          <td className={styles.identificador}>{e.serie || "Pendiente"}</td><td className={styles.identificador}>{e.inventario || "Pendiente"}</td>
          <td><span className={`${styles.estado} ${e.situacion === "pendiente_entrega" ? styles.pendiente : styles.recibido}`}>{e.situacion === "recibido_historico" ? "Recibido (histórico)" : SITUACIONES[e.situacion as keyof typeof SITUACIONES]}</span>
            <small>Condición: {CONDICIONES[e.condicionTecnica]}</small></td>
          <td><Link className={styles.historial} href={`/inventario/${e.id}#historial`}
            aria-label={`Ver historial del equipo ${e.inventario || e.serie || e.modelo}`}>Ver historial</Link></td>
        </tr>)}
          {!equipos.length && <tr><td colSpan={ambito === "eeji" ? 8 : 6} className={styles.vacio}>No hay equipos que coincidan con los filtros seleccionados.</td></tr>}
        </tbody>
      </table>
    </div>
    <nav className={styles.paginacion} aria-label="Páginas de equipos">
      <span>Página {pagina} de {paginas} · {total ? `${(pagina - 1) * limite + 1}–${Math.min(pagina * limite, total)} de ${total.toLocaleString("es-CL")}` : "Sin resultados"}</span>
      <div>{pagina > 1 && <Link href={url(vista, pagina - 1)}>Anterior</Link>}
        {pagina < paginas && <Link href={url(vista, pagina + 1)}>Siguiente</Link>}</div>
    </nav>
    </section>
  </main>;
}
