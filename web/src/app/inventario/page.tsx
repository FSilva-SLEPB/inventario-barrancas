import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";
import { listarEquipos } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { puedeAdministrar, puedeGestionarDependencias, requiereSede } from "@/lib/politica-acceso";
import { CONDICIONES, SITUACIONES } from "@/lib/validacion-equipos";
import FormularioEquipo from "@/components/formulario-equipo";
import FiltrosInventario from "@/components/filtros-inventario";
import { esIdSede } from "@/lib/validacion-sedes";
import styles from "./inventario.module.css";

export const metadata = { title: "Inventario | SLEP Barrancas" };

export default async function Inventario({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await exigirAcceso();
  const p = await searchParams;
  const local = requiereSede(actor.rol);
  const ambito = !local && p.ambito === "nc" ? "nc" : "eeji";
  const vista = ambito === "eeji" && p.vista === "pendientes" ? "pendientes" : "inventario";
  const q = typeof p.q === "string" ? p.q.trim().slice(0, 120) : "";
  const numero = typeof p.pagina === "string" && /^\d{1,7}$/.test(p.pagina) ? Math.max(1, Number(p.pagina)) : 1;
  const tipo = !local && ambito === "eeji" && ["establecimiento", "jardin_infantil"].includes(String(p.tipo)) ? String(p.tipo) : "";
  const sedeId = !local && ambito === "eeji" && typeof p.sede === "string" && esIdSede(p.sede) ? p.sede : null;
  const rbd = !local && ambito === "eeji" && typeof p.rbd === "string" ? p.rbd.trim().slice(0, 120) : "";
  const editar = puedeGestionarDependencias(actor.rol);
  const [{ equipos, total, pagina }, sedes, categorias] = await Promise.all([
    listarEquipos(ambito, vista, numero, q, tipo, sedeId, rbd),
    listarSedes(), editar ? listarCategorias() : Promise.resolve([]),
  ]);
  const sedesAmbito = sedes.filter(s => ambito === "nc" ? s.tipo === "nivel_central" : s.tipo !== "nivel_central");
  const sedesFiltro = sedesAmbito.filter(s => !tipo || s.tipo === tipo);
  const url = (v: string, n = 1) => `/inventario?${new URLSearchParams({
    ambito, vista: v, q, pagina: String(n), tipo, sede: sedeId ?? "", rbd,
  })}`;
  const paginas = Math.max(1, Math.ceil(total / 50));

  return <main className={styles.inventario}>
    <div className={styles.cabecera}>
      <div><h1>{ambito === "nc" ? "Inventario Nivel Central" : "Inventario P02"}</h1>
        <p>{local ? "Inventario de mi sede" : ambito === "nc" ? "Equipos de Nivel Central" : "Establecimientos educacionales, jardines infantiles y salas cunas"}</p>
      </div>
      <div className={styles.herramientas}>
        {editar && <a className="btn btn-outline-primary btn-sm" href="#nuevo-equipo">Registrar equipo</a>}
        {puedeAdministrar(actor.rol) && <Link href="/inventario/carga">Carga histórica</Link>}
      </div>
    </div>
    {!local && <nav className={styles.ambitos} aria-label="Vistas de inventario">
      <Link href="/inventario?ambito=nc" aria-current={ambito === "nc" ? "page" : undefined}>Inventario Nivel Central</Link>
      <Link href="/inventario?ambito=eeji" aria-current={ambito === "eeji" ? "page" : undefined}>Inventario P02</Link>
    </nav>}
    {ambito === "eeji" && <nav className={styles.vistas} aria-label="Estado de entrega">
      <Link href={url("inventario")} aria-current={vista === "inventario" ? "page" : undefined}>Equipos recibidos</Link>
      <Link href={url("pendientes")} aria-current={vista === "pendientes" ? "page" : undefined}>Pendientes de entrega</Link>
    </nav>}
    {vista === "pendientes" && <p className={styles.aviso}>Estos equipos están destinados a la sede y aún no forman parte de su inventario recibido.</p>}
    <FiltrosInventario key={JSON.stringify([ambito, vista, tipo, sedeId, rbd, q])}
      {...{ ambito, vista, local, tipo, rbd, q }} sedeId={sedeId ?? ""} sedes={sedesFiltro} />
    <div className={styles.resumen}>
      <p><strong>{total.toLocaleString("es-CL")}</strong> equipos encontrados</p>
      <span>Página {pagina} de {paginas}</span>
    </div>
    <div className={styles.contenedorTabla} role="region" aria-label="Resultados del inventario" tabIndex={0}>
      <table className={styles.tabla}>
        <caption className="visually-hidden">{ambito === "nc" ? "Inventario Nivel Central" : "Inventario P02"}: {vista === "pendientes" ? "pendientes de entrega" : "equipos registrados / recibidos"}</caption>
        <thead><tr>
          {ambito === "eeji" && <><th scope="col">RBD</th><th scope="col">Establecimiento / JISC</th></>}
          <th scope="col">Equipo</th><th scope="col">Modelo</th><th scope="col">N.º de serie</th>
          <th scope="col">N.º de inventario</th><th scope="col">Estado</th><th scope="col">Historial</th>
        </tr></thead>
        <tbody>{equipos.map(e => <tr key={e.id}>
          {ambito === "eeji" && <><td>{e.sedeRbd || "Sin RBD"}</td><td>{e.sedeNombre}</td></>}
          <td>{e.categoriaNombre}</td><td><span>{e.modelo}</span><small>{e.marca}</small></td>
          <td>{e.serie || "Pendiente"}</td><td>{e.inventario || "Pendiente"}</td>
          <td><span className={styles.estado}>{e.situacion === "recibido_historico" ? "Recibido (histórico)" : SITUACIONES[e.situacion as keyof typeof SITUACIONES]}</span>
            <small>Condición: {CONDICIONES[e.condicionTecnica]}</small></td>
          <td><Link href={`/inventario/${e.id}#historial`}
            aria-label={`Ver historial del equipo ${e.inventario || e.serie || e.modelo}`}>Ver historial</Link></td>
        </tr>)}
          {!equipos.length && <tr><td colSpan={ambito === "eeji" ? 8 : 6} className={styles.vacio}>No hay equipos que coincidan con los filtros seleccionados.</td></tr>}
        </tbody>
      </table>
    </div>
    <nav className={styles.paginacion} aria-label="Páginas de equipos">
      <span>{total ? `${(pagina - 1) * 50 + 1}–${Math.min(pagina * 50, total)} de ${total.toLocaleString("es-CL")}` : "Sin resultados"}</span>
      <div>{pagina > 1 && <Link href={url(vista, pagina - 1)}>Anterior</Link>}
        {pagina < paginas && <Link href={url(vista, pagina + 1)}>Siguiente</Link>}</div>
    </nav>
    {editar && <section className={styles.registro} id="nuevo-equipo">
      <h2>Registrar equipo</h2>
      <div className="panel-catalogos">
        <p>El registro conserva su identidad e historial. Las correcciones no trasladan equipos ni generan bajas.</p>
        {categorias.length && sedesAmbito.length ? <FormularioEquipo sedes={sedesAmbito} categorias={categorias} local={local} />
          : <p>Se requiere una sede y una categoría activa en los mantenedores.</p>}
      </div>
    </section>}
  </main>;
}
