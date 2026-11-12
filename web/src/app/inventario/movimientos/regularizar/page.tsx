import Link from "next/link";
import { randomUUID } from "node:crypto";
import { exigirPermiso } from "@/lib/acceso";
import { seleccionarEntregas, ErrorSeleccionEntrega } from "@/lib/entregas";
import { hoyChile } from "@/lib/validacion-entregas";
import FormularioRegularizacion from "@/components/formulario-regularizacion";
import type { ParametrosInventario } from "@/components/vista-inventario";
export const metadata = { title: "Regularizar entregas | Inventario" };
export default async function Regularizar({ searchParams }: ParametrosInventario) {
  await exigirPermiso('movimientos','consultar');
  let equipos; let error = "";
  try { equipos = await seleccionarEntregas(await searchParams); } catch (e) {
    error = e instanceof ErrorSeleccionEntrega ? e.message : "No se pudo preparar la selección. Inténtalo nuevamente.";
    if (!(e instanceof ErrorSeleccionEntrega)) console.error("No se pudo consultar la selección de entrega.");
  }
  return <main><header><h1>Regularizar entregas de jardines</h1>
    <p className="descripcion-pagina">Registra entregas ya realizadas, agrupadas por jardín, conservando su directora receptora y fecha real. Los equipos dejarán de estar pendientes y pasarán a recibidos en P02.</p>
    </header>
    <div className="acciones-catalogos"><Link className="btn btn-outline-primary btn-sm" href="/inventario/bodega-ti">Volver a Bodega TI</Link></div>
    {equipos ? <FormularioRegularizacion equipos={equipos} solicitud={randomUUID()} hoy={hoyChile()} /> : <p role="alert">{error}</p>}
  </main>;
}
