import Link from "next/link";
import { notFound } from "next/navigation";
import { detalleEntrega } from "@/lib/entregas";
export const metadata = { title: "Detalle de entrega | Inventario" };
export default async function Entrega({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const e = await detalleEntrega(id); if (!e) notFound();
  return <main><header><h1>Entrega regularizada</h1><p><Link href="/inventario/movimientos">Volver a Movimientos y actas</Link></p></header>
    <dl><dt>Jardín / RBD</dt><dd>{e.rbd ? `${e.rbd} · ` : ""}{e.sedeNombre}</dd><dt>Comuna</dt><dd>{e.comuna||"Sin informar"}</dd>
      <dt>Fecha real de entrega</dt><dd>{e.fecha.split("-").reverse().join("/")}</dd><dt>Directora receptora</dt><dd>{e.receptora} · {e.cargo}</dd>
      <dt>Registro de la regularización</dt><dd>{new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short",timeZone:"America/Santiago"}).format(new Date(e.registrado))} · {e.actor}</dd>
      <dt>Acta existente</dt><dd>Sin folio informado. {e.enlace && <a href={e.enlace} target="_blank" rel="noopener noreferrer">Consultar documento</a>}</dd></dl>
    <div className="tabla-usuarios-contenedor"><table className="tabla-catalogos"><caption>{e.items.length} equipos entregados · datos conservados al confirmar</caption>
      <thead><tr><th scope="col">Equipo</th><th scope="col">Serie</th><th scope="col">Inventario</th><th scope="col">Historial</th></tr></thead>
      <tbody>{e.items.map(item=><tr key={item.id}><td>{String(item.despues.marca)} {String(item.despues.modelo)}</td><td>{String(item.despues.serie??"Pendiente")}</td>
        <td>{String(item.despues.numero_inventario??"Pendiente")}</td><td><Link href={`/inventario/${item.id}#historial`}>Ver historial</Link></td></tr>)}</tbody>
    </table></div>
  </main>;
}
