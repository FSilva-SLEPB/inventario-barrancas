import Link from "next/link";
import { exigirAdministrador } from "@/lib/acceso";
import FormularioCargaEquipos from "@/components/formulario-carga-equipos";
export const metadata={title:"Carga histórica de equipos | Inventario"};
export default async function CargaEquipos() {
  await exigirAdministrador();
  return <main><h1>Carga histórica de equipos</h1><p><Link href="/inventario">Volver al inventario</Link></p>
    <p>Exporta únicamente la hoja InventarioTotal como CSV UTF-8 o utiliza la <a href="/plantillas/equipos-historicos.csv" download>plantilla CSV</a>.
      No unas las hojas anuales al consolidado: podrías duplicar los mismos bienes.</p>
    <p>En Excel, mantén RBD, series y números de inventario como texto para conservar ceros y guiones.</p>
    <p>El estado Activo se conserva como recibido histórico; En Bodega del SLEP queda pendiente de entrega.
      No se inventan fechas ni actas. La condición técnica inicial queda sin verificar.</p>
    <p>El RBD debe coincidir con una sede activa y la categoría con una categoría activa del mantenedor.
      Usa NC solo para una carga histórica de Nivel Central, que permanecerá separada de EE/JI.</p>
    <p>Los campos personales de directores de la planilla no se importan aquí. Esta carga tampoco registra robos, bajas ni traspasos.</p>
    <FormularioCargaEquipos/>
  </main>;
}
