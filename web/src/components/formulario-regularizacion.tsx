"use client";
import { useActionState } from "react";
import { regularizarEntregas, type EstadoRegularizacion } from "@/app/inventario/movimientos/regularizar/acciones";
import { fechaSugeridaEntrega, type BaseEntrega } from "@/lib/validacion-entregas";
import type { EquipoEntrega } from "@/lib/entregas";

export default function FormularioRegularizacion({ equipos, solicitud, hoy }: { equipos: EquipoEntrega[]; solicitud: string; hoy: string }) {
  const [estado, accion, pendiente] = useActionState(regularizarEntregas, { estado:"inicial",mensaje:"",valores:{} } as EstadoRegularizacion);
  const grupos = Object.values(equipos.reduce<Record<string,{sedeId:string;nombre:string;rbd:string|null;comuna:string|null;equipos:EquipoEntrega[]}>>((a,e) => {
    a[e.sedeId] ??= {sedeId:e.sedeId,nombre:e.sedeNombre,rbd:e.rbd,comuna:e.comuna,equipos:[]}; a[e.sedeId].equipos.push(e); return a;
  }, {}));
  const seleccion: BaseEntrega[] = grupos.map(g => ({sedeId:g.sedeId,equipos:g.equipos.map(e=>({id:e.id,version:e.version}))}));
  return <form action={accion} aria-busy={pendiente} className="regularizacion-formulario">
    <input type="hidden" name="solicitud" value={solicitud} /><input type="hidden" name="seleccion" value={JSON.stringify(seleccion)} />
    <p><strong>{equipos.length} equipos · {grupos.length} jardines.</strong> Las fechas propuestas corresponden a las entregas de octubre de 2026 por comuna. Revisa cada grupo.</p>
    <fieldset disabled={pendiente} className="border-0 p-0 m-0">
      <legend className="visually-hidden">Revisión por jardín</legend>
      {grupos.map(g => <section className="panel-catalogos grupo-entrega" key={g.sedeId}>
        <h2>{g.rbd ? `${g.rbd} · ` : ""}{g.nombre}</h2><p>{g.comuna || "Comuna no informada"} · {g.equipos.length} equipos</p>
        <div className="datos-entrega">
          <div className="campo-catalogos"><label htmlFor={`fecha-${g.sedeId}`}>Fecha real de entrega</label>
            <input id={`fecha-${g.sedeId}`} name={`fecha-${g.sedeId}`} type="date" min="1900-01-01" max={hoy} required defaultValue={estado.valores[`fecha-${g.sedeId}`] ?? fechaSugeridaEntrega(g.comuna)} /></div>
          <div className="campo-catalogos"><label htmlFor={`receptora-${g.sedeId}`}>Nombre de la directora que recibió</label>
            <input id={`receptora-${g.sedeId}`} name={`receptora-${g.sedeId}`} required maxLength={200} defaultValue={estado.valores[`receptora-${g.sedeId}`] ?? ""} />
            <p className="ayuda-catalogos">Cargo: Directora del jardín infantil. Se conserva el nombre de quien recibió en esa fecha.</p></div>
          <div className="campo-catalogos"><label htmlFor={`acta-${g.sedeId}`}>Enlace al acta existente (opcional)</label>
            <input id={`acta-${g.sedeId}`} name={`acta-${g.sedeId}`} type="url" maxLength={1500} defaultValue={estado.valores[`acta-${g.sedeId}`] ?? ""} />
            <p className="ayuda-catalogos">Acta existente sin folio informado. No se genera un número ni un acta nueva.</p></div>
        </div>
        <div className="tabla-usuarios-contenedor"><table className="tabla-catalogos"><caption>Equipos que se marcarán como recibidos</caption>
          <thead><tr><th scope="col">Equipo</th><th scope="col">Serie</th><th scope="col">Inventario</th></tr></thead>
          <tbody>{g.equipos.map(e=><tr key={e.id}><td>{e.marca} {e.modelo}</td><td>{e.serie||"Pendiente"}</td><td>{e.inventario||"Pendiente"}</td></tr>)}</tbody>
        </table></div>
      </section>)}
      <label className="confirmacion-entrega"><input type="checkbox" name="confirmo" value="si" required /> Revisé equipos, fechas y directoras receptoras y confirmo que estas entregas ya se realizaron.</label>
      <p>La fecha de registro se guarda por separado. Si algún equipo cambió durante la revisión, la operación completa se cancela.</p>
      <button type="submit" className="boton-catalogos" disabled={pendiente}>{pendiente?"Confirmando…":`Confirmar ${equipos.length === 1 ? "equipo entregado" : `${equipos.length} equipos entregados`}`}</button>
    </fieldset>
    <p role={estado.estado === "error" ? "alert" : "status"}>{estado.mensaje}</p>
  </form>;
}
