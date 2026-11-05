import VentanaActaEmitida from '@/components/actas/ventana-acta-emitida';
import AccionesRegistro from '@/components/acciones-registro';
import VentanaMovimiento,{AccionesCustodia} from '@/components/ventana-movimiento';
import Link from "next/link";
import PanelResultados from '@/components/panel-resultados';
import {notFound} from 'next/navigation';
import ModalFicha from '@/components/modal-ficha';
import FichaEquipo from '@/components/ficha-equipo';
import {enlaceFichaInventario,equipoEnVista} from '@/lib/ficha-inventario';
import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { listarEquipos,obtenerEquipo } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { puedeAdministrar, puedeGestionarDependencias, requiereSede } from "@/lib/politica-acceso";
import {CUSTODIAS} from '@/lib/validacion-movimientos-inventario';
import { CONDICIONES } from "@/lib/validacion-equipos";
import SeleccionEntregas, { SeleccionarTodos } from "@/components/seleccion-entregas";
import FiltrosInventario from "@/components/filtros-inventario";
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
  const vista = bodega ? "pendientes" : p.vista === "pendientes" ? "pendientes" : "inventario";
  const q = typeof p.q === "string" ? p.q.trim().slice(0, 150) : "";
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
  const volver=url(vista,pagina);
  const editar=typeof p.editar==='string'?p.editar:'',seleccionado=editar||(typeof p.ver==='string'?p.ver:'');
  if(seleccionado&&!esIdSede(seleccionado))notFound();
  const equipoSeleccionado=seleccionado?await obtenerEquipo(seleccionado):null;
  if(seleccionado&&(!equipoSeleccionado||!equipoEnVista(equipoSeleccionado,ambito,vista)))notFound();
  const editando=Boolean(editar&&equipoSeleccionado&&equipoSeleccionado.custodia!=='en_prestamo'&&puedeGestionarDependencias(actor.rol)&&(puedeAdministrar(actor.rol)||equipoSeleccionado.custodia!=='en_bodega'));
  const titulo = bodega ? "Bodega TI" : ambito === "nc" ? "Inventario Nivel Central" : "Inventario P02";
  const paginas = Math.max(1, Math.ceil(total / limite));

  return <main className={styles.inventario}>
    <div className={styles.cabecera}>
      <div><p className={styles.etiqueta}>Gestión de inventario</p><h1>{titulo}</h1>
        <p className={styles.descripcion}>{bodega ? "Equipos pendientes de entrega a establecimientos, jardines infantiles y salas cunas" : local ? "Inventario de mi sede" : ambito === "nc" ? "Equipos de Nivel Central" : "Establecimientos educacionales, jardines infantiles y salas cunas"}</p>
      </div>
      <div className={styles.herramientas}>
        <Link className="btn btn-outline-primary btn-sm" href="/inventario">Volver a Inventario</Link>
        <Link className="btn btn-outline-primary btn-sm" href="/inventario/robos">Consolidado de robos</Link>
        {puedeGestionarDependencias(actor.rol) && <Link className="btn btn-outline-primary btn-sm" href="/inventario/registro">Ir al registro</Link>}
      </div>
    </div>
    {vista === "pendientes" && <p className={styles.aviso}>Estos equipos están en Bodega TI. La sede indica su referencia de destino o procedencia; UTIC confirma su asignación.</p>}
    <FiltrosInventario key={JSON.stringify([ambito, vista, tipo, sedeId, rbd, q, limite])}
      {...{ ambito, vista, local, tipo, rbd, q, limite, bodega }} sedeId={sedeId ?? ""} sedes={sedesFiltro} />
    <PanelResultados total={total} descripcion={vista==='pendientes'?'bienes en Bodega TI':'equipos registrados / recibidos'} ruta={ruta} limite={limite} filtros={{vista,tipo,sede:sedeId??'',rbd,q}} pagina={pagina} paginas={paginas} acciones={bodega?<SeleccionEntregas pagina={equipos.map(e=>e.id).join(',')}/>:undefined}>
    <div className={`${styles.contenedorTabla} tabla-contenedor tabla-inventario-contenedor`} role="region" aria-label="Resultados del inventario" tabIndex={0}>
      <table className={`tabla-datos ${styles.tabla} ${ambito === "eeji" ? styles.tablaP02 : styles.tablaCentral} ${bodega ? styles.tablaSeleccion : ""}`}>
        <caption className="visually-hidden">{titulo}: {vista === "pendientes" ? "pendientes de entrega" : "equipos registrados / recibidos"}</caption>
        <thead><tr>
          {bodega && <th scope="col"><SeleccionarTodos pagina={equipos.map(e=>e.id).join(",")}/></th>}
          {ambito === "eeji" && <><th scope="col">RBD</th><th scope="col">Establecimiento / JISC</th></>}
          <th scope="col">Equipo</th><th scope="col">Modelo</th><th scope="col">N.º de serie</th>
          <th scope="col">N.º de inventario</th><th scope="col">Estado</th><th scope="col">Acciones</th>
        </tr></thead>
        <tbody>{equipos.map(e => <tr key={e.id}>
          {bodega && <td><input type="checkbox" name="equipo" form="seleccion-entregas" value={e.id} disabled={e.sedeTipo!=="jardin_infantil"||Boolean(e.roboEstado)}
            aria-label={`Seleccionar ${e.inventario || e.serie || e.modelo} de ${e.sedeNombre}`} /></td>}
          {ambito === "eeji" && <><td className={styles.rbd}>{e.sedeRbd || "Sin RBD"}</td><td>{e.sedeNombre}</td></>}
          <td>{e.categoriaNombre}</td><td><span>{e.modelo}</span><small>{e.marca}</small></td>
          <td className={styles.identificador}>{e.serie || "Pendiente"}</td><td className={styles.identificador}>{e.inventario || "Pendiente"}</td>
          <td><span className={`estado-custodia ${e.custodia}`}>{CUSTODIAS[e.custodia as keyof typeof CUSTODIAS]??(e.situacion==='pendiente_entrega'?CUSTODIAS.en_bodega:CUSTODIAS.asignado)}</span>{e.situacion==='recibido_historico'&&<small>Recibido (histórico)</small>}
            {e.roboEstado&&<small className="alerta-incidente">{e.roboEstado==='validado'?'Robo validado · sin recuperar':'Robo reportado · pendiente de validación'}</small>}
            <small>Funcionamiento: {CONDICIONES[e.condicionTecnica]}</small></td>
          <td><AccionesRegistro id={e.id} nombre={'equipo '+(e.inventario||e.serie||e.modelo)} verHref={enlaceFichaInventario(volver,'ver',e.id)} editarHref={e.custodia==='en_prestamo'?undefined:puedeGestionarDependencias(actor.rol)&&(puedeAdministrar(actor.rol)||e.custodia!=='en_bodega')?enlaceFichaInventario(volver,'editar',e.id):undefined}><AccionesCustodia tipo="equipo" id={e.id} custodia={e.custodia} volver={volver} permitido={puedeAdministrar(actor.rol)&&!e.roboEstado}/></AccionesRegistro>
          </td>
        </tr>)}
          {!equipos.length && <tr><td colSpan={bodega ? 9 : ambito === "eeji" ? 8 : 6} className={styles.vacio}>No hay equipos que coincidan con los filtros seleccionados.</td></tr>}
        </tbody>
      </table>
    </div>
    </PanelResultados>
    <VentanaMovimiento parametros={p} volver={volver}/><VentanaActaEmitida parametros={p} volver={volver}/>
    {seleccionado&&<ModalFicha titulo={editando?'Editar equipo':'Registro del equipo'} cerrarHref={volver} editando={editando} focoId={seleccionado}>
      <FichaEquipo equipo={equipoSeleccionado??undefined} id={seleccionado} editar={editando} contexto={{volver,ambito,vista,verHref:enlaceFichaInventario(volver,'ver',seleccionado),editarHref:enlaceFichaInventario(volver,'editar',seleccionado)}}/>
    </ModalFicha>}
  </main>;
}
