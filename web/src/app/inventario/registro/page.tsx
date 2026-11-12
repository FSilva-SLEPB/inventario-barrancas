import ModalFicha from '@/components/modal-ficha';
import {retornoInventario} from '@/lib/ficha-inventario';
import Link from "next/link";
import { exigirGestionDependencias } from "@/lib/acceso";
import { puedeAdministrar, requiereSede } from "@/lib/politica-acceso";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import RegistroEquipos from "@/components/registro-equipos";
import FormularioCargaEquipos from "@/components/formulario-carga-equipos";

export const metadata = { title: "Registro de equipos | SLEP Barrancas" };

export default async function Registro({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const p=await searchParams,volver=retornoInventario(p.volver)??'/inventario';
  const actor = await exigirGestionDependencias();
  const [sedes, categorias] = await Promise.all([listarSedes(), listarCategorias()]);
  return <main>
    <header><h1>Registro de equipos</h1>
      <p className="descripcion-pagina">Registra equipos en su inventario de destino. Cada ingreso conserva su identidad y su historial.</p>
    </header>
    <div className="acciones-catalogos"><Link className="btn btn-outline-primary btn-sm" href="/inventario">Volver a Inventario</Link></div>
    {p.carga!=='1'&&<ModalFicha titulo="Registrar equipo" cerrarHref={volver} editando><RegistroEquipos sedes={sedes} categorias={categorias} local={requiereSede(actor)} volver={volver}/></ModalFicha>}
    {p.carga==='1'&&puedeAdministrar(actor) && <section className="panel-catalogos registro-carga" id="carga-masiva" aria-labelledby="carga-masiva-titulo">
      <h2 id="carga-masiva-titulo">Carga masiva de equipos</h2>
      <p>Importa un CSV con vista previa. El destino de cada equipo se indica en el archivo mediante su RBD o el código NC para Nivel Central.</p>
      <p><a href="/plantillas/equipos-historicos.csv" download>Descargar plantilla CSV</a></p>
      <details className="instrucciones-carga"><summary>Instrucciones para preparar el archivo</summary>
        <p>Exporta únicamente la hoja InventarioTotal como CSV UTF-8 o utiliza la plantilla. No unas las hojas anuales al consolidado.</p>
        <p>Mantén RBD, series y números de inventario como texto para conservar ceros y guiones. El RBD y la categoría deben coincidir con catálogos activos.</p>
        <p>Activo se conserva como recibido histórico y En Bodega del SLEP como pendiente de entrega. No se inventan fechas ni actas; la condición técnica inicial queda sin verificar.</p>
        <p>Los datos personales de directores no se importan. Esta carga no registra robos, bajas ni traspasos.</p>
      </details>
      <FormularioCargaEquipos />
    </section>}
  </main>;
}
