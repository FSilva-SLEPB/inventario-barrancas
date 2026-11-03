import Link from "next/link";
import { listarEntregas, resumenLote } from "@/lib/entregas";
export const metadata = { title: "Movimientos y actas | Inventario" };
export default async function Movimientos({ searchParams }: {searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const entregas = await listarEntregas();
  const p = await searchParams;
  const lote = typeof p.lote === "string" ? await resumenLote(p.lote) : null;
  return <main><header><h1>Movimientos y actas</h1>
    <p className="descripcion-pagina">Consulta las entregas registradas y sus antecedentes. Cada jardín conserva su fecha real, directora receptora y equipos asociados.</p>
    <p><Link href="/inventario">Volver a Inventario</Link></p></header>
    {lote && <p role="status" className="panel-catalogos">Regularización registrada: {lote.cantidad} equipos incorporados como recibidos en P02, con historial. Los reintentos de esta operación no duplican las entregas.</p>}
    <div className="acciones-catalogos"><Link className="btn btn-primary" href="/inventario/bodega-ti">Seleccionar equipos para regularizar</Link></div>
    <p className="nota-movimientos">Los antecedentes de las actas existentes se conservan con la entrega. La generación de actas nuevas se incorporará en su siguiente etapa.</p>
    <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos tabla-movimientos"><caption>Últimas 100 entregas regularizadas, agrupadas por jardín</caption>
      <thead><tr><th scope="col">Jardín / RBD</th><th scope="col">Comuna</th><th scope="col">Fecha de entrega</th><th scope="col">Directora receptora</th><th scope="col">Equipos</th><th scope="col">Detalle</th></tr></thead>
      <tbody>{entregas.map(e=><tr key={e.id}><td>{e.rbd ? `${e.rbd} · ` : ""}{e.sedeNombre}</td><td>{e.comuna||"Sin informar"}</td>
        <td>{e.fecha.split("-").reverse().join("/")}</td><td>{e.receptora}</td><td>{e.cantidad}</td><td><Link href={`/inventario/movimientos/entregas/${e.id}`}>Ver entrega</Link></td></tr>)}
        {!entregas.length && <tr><td colSpan={6}>Todavía no hay entregas regularizadas.</td></tr>}</tbody>
    </table></div>
  </main>;
}
