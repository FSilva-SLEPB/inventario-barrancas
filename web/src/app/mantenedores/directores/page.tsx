import Link from "next/link";
import { listarDirectorio, historialDirectorio } from "@/lib/directorio";
import { esIdSede } from "@/lib/validacion-sedes";
import FormularioDirector, { CargaDirectorio } from "@/components/formulario-director";
export const metadata={title:'Directorio de directores | Inventario'};
export default async function Directores({searchParams}:{searchParams:Promise<{editar?:string|string[]}>}){
  const directorio=await listarDirectorio(),p=await searchParams;
  const seleccionado=typeof p.editar==='string'&&esIdSede(p.editar)?directorio.find(d=>d.sedeId===p.editar):undefined;
  const historia=seleccionado?await historialDirectorio(seleccionado.sedeId):[];
  return <main><header><h1>Directorio de directores y directoras</h1><p className="descripcion-pagina">Responsables de establecimientos y JISC. Las entregas proponen este nombre automáticamente; las entregas anteriores conservan a quien recibió en ese momento.</p><p><Link href="/mantenedores">Volver a Mantenedores</Link></p></header>
    {seleccionado&&<section className="panel-catalogos" id="editar-director"><h2>Editar responsable</h2><FormularioDirector key={seleccionado.sedeId} director={seleccionado}/><Link href="/mantenedores/directores">Cerrar edición</Link>
      {historia.length>0&&<details><summary>Historial del responsable</summary><ol>{historia.map((h,i)=><li key={i}><p>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(h.fecha))} · {h.actor}</p><p>{h.antes?.nombre??'Sin registrar'} → {h.despues.nombre} · {h.motivo}</p></li>)}</ol></details>}
    </section>}
    <div className="tabla-usuarios-contenedor"><table className="tabla-catalogos tabla-directorio"><caption>{directorio.length} establecimientos y JISC activos</caption><thead><tr><th>RBD</th><th>Establecimiento/JISC</th><th>Comuna</th><th>Director/a</th><th>Editar</th></tr></thead>
      <tbody>{directorio.map(d=><tr key={d.sedeId}><td>{d.rbd||'Sin RBD'}</td><td>{d.sedeNombre}</td><td>{d.comuna||'Sin informar'}</td><td>{d.nombre||'Pendiente de cargar'}</td><td><Link href={`/mantenedores/directores?editar=${d.sedeId}#editar-director`} aria-label={`Editar responsable de ${d.sedeNombre}`}>✎ Editar</Link></td></tr>)}</tbody></table></div>
    <details className="panel-catalogos" id="cargar-directorio"><summary>Cargar listado de responsables</summary><p>Exporta el listado como CSV UTF-8 con las columnas RBD y Nombre. El RBD debe coincidir exactamente con la sede registrada. La vista previa permite revisar las correspondencias y los cambios antes de guardarlos.</p><p><a href="/plantillas/directorio-responsables.csv" download>Descargar plantilla</a></p><CargaDirectorio/></details>
  </main>;
}
