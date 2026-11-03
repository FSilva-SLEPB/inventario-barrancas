import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar,puedeGestionarDependencias } from "@/lib/politica-acceso";
import { esIdSede } from "@/lib/validacion-sedes";
import { etiquetaSede } from "@/lib/etiqueta-sede";
import { obtenerEquipo,historialEquipo,equipoAFormulario } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { CAMPOS_COMPRA,CONDICIONES,ORIGENES,SITUACIONES } from "@/lib/validacion-equipos";
import { robosEquipo } from "@/lib/robos";
import { ESTADOS_ROBO } from "@/lib/validacion-robos";
import { cambiosHistorial } from "@/lib/presentacion-historial";
import FormularioEquipo from "@/components/formulario-equipo";
export const metadata={title:'Ficha e historial del equipo | Inventario'};
export default async function FichaEquipo({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{editar?:string|string[];guardado?:string|string[]}>}){
  const actor=await exigirAcceso(),{id}=await params;if(!esIdSede(id))notFound();
  const e=await obtenerEquipo(id);if(!e)notFound();
  const [historial,categorias,p,robos]=await Promise.all([historialEquipo(id),listarCategorias(),searchParams,robosEquipo(id)]);
  const editable=puedeGestionarDependencias(actor.rol)&&(puedeAdministrar(actor.rol)||e.situacion!=='pendiente_entrega');
  const editando=editable&&p.editar==='si';const sedes=editando?await listarSedes():[];
  const compra=Object.entries(CAMPOS_COMPRA).filter(([k])=>e.compra[k as keyof typeof CAMPOS_COMPRA]);
  const dato=(label:string,v:string|null|undefined)=><div key={label}><dt>{label}</dt><dd>{v||'Sin informar'}</dd></div>;
  return <main className="ficha-equipo"><header className="ficha-cabecera"><div><p className="etiqueta-ficha">Ficha e historial</p><h1>{e.categoriaNombre} · {e.marca} {e.modelo}</h1><p className="descripcion-pagina">{etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd})}</p></div>
    <div className="acciones-catalogos">{editable&&!editando&&<Link className="btn btn-outline-primary" href={`/inventario/${id}?editar=si#editar-equipo`} aria-label="Editar información del equipo">✎ Editar información</Link>}
      <Link href={`/inventario/${e.sedeTipo==='nivel_central'?'nivel-central':'p02'}?vista=${e.situacion==='pendiente_entrega'?'pendientes':'inventario'}`}>Volver al inventario</Link></div></header>
    {p.guardado==='1'&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
    {editando?<section id="editar-equipo" className="ficha-seccion"><h2>Editar información</h2><p><Link href={`/inventario/${id}`}>Cancelar edición</Link></p><div id="formulario-equipo"><FormularioEquipo key={id} inicial={equipoAFormulario(e)} sedes={sedes} categorias={categorias} local={!puedeAdministrar(actor.rol)}/></div></section>
    :<div className="ficha-secciones"><section className="ficha-seccion"><h2>Identificación</h2><dl className="ficha-datos">{dato('Categoría',e.categoriaNombre)}{dato('Marca',e.marca)}{dato('Modelo',e.modelo)}{dato('Número de serie',e.serie||'Pendiente')}{dato('Número de inventario',e.inventario||'Pendiente')}
      {(!e.serie||!e.inventario)&&e.motivoIdentificacion&&dato('Dato pendiente',e.motivoIdentificacion)}</dl></section>
      <section className="ficha-seccion"><h2>Entrega y funcionamiento</h2><dl className="ficha-datos">{dato('Inventario / sede',etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd}))}{dato('Situación de entrega',SITUACIONES[e.situacion as keyof typeof SITUACIONES])}{dato('Origen',ORIGENES[e.origen])}{dato('Estado de funcionamiento',CONDICIONES[e.condicionTecnica])}
        {e.fechaEntrega&&dato('Fecha de entrega',e.fechaEntrega.split('-').reverse().join('/'))}{e.enlaceActa&&<div><dt>Acta existente</dt><dd><a href={e.enlaceActa} target="_blank" rel="noopener noreferrer">Consultar documento</a></dd></div>}</dl>
        <p className="ayuda-catalogos">El funcionamiento indica si está operativo o necesita reparación; no determina su entrega ni una baja.</p></section>
      {compra.length>0&&<section className="ficha-seccion ficha-adquisicion"><h2>Adquisición</h2><dl className="ficha-datos">{compra.map(([k,label])=>dato(label,e.compra[k as keyof typeof CAMPOS_COMPRA]))}</dl></section>}
      {(e.observaciones||e.archivoOrigen)&&<section className="ficha-seccion"><h2>Antecedentes</h2>{e.observaciones&&<p>{e.observaciones}</p>}{e.archivoOrigen&&<p>Archivo de origen: {e.archivoOrigen} · fila {e.filaOrigen}.</p>}</section>}
    </div>}
    {robos.length>0&&<section className="ficha-seccion"><h2>Incidentes de robo</h2><ul>{robos.map(r=><li key={r.id}>{r.fecha.split('-').reverse().join('/')} · {ESTADOS_ROBO[(r.recuperadoFecha?'recuperado':r.estado) as keyof typeof ESTADOS_ROBO]} {puedeGestionarDependencias(actor.rol)&&<Link href={'/inventario/robos/'+r.id}>Ver incidente</Link>}</li>)}</ul></section>}
    <section id="historial" className="historial-equipo"><h2>Historial del equipo</h2><p className="ayuda-catalogos">Registro de ingresos, entregas y actualizaciones, con fecha y responsable. Las ediciones conservan el valor anterior y el nuevo.</p>
      <ol className="linea-historial">{historial.map((h,i)=>{
        const cambios=cambiosHistorial(h.antes,h.despues,categorias);
        return <li key={i}><article className="evento-historial"><div className="evento-cabecera"><strong>{h.incidenteId?'Incidente de robo':h.entregaId?'Entrega registrada':h.antes?'Información actualizada':'Registro inicial'}</strong><time>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(h.registradoEn))}</time></div>
          <p className="evento-actor">{h.actor}</p><p>{h.motivo}</p>
          {h.entregaId&&puedeAdministrar(actor.rol)&&<p><Link href={`/inventario/movimientos/entregas/${h.entregaId}`}>Ver entrega y receptora</Link></p>}
          {h.incidenteId&&puedeGestionarDependencias(actor.rol)&&<p><Link href={'/inventario/robos/'+h.incidenteId}>Ver incidente y seguimiento</Link></p>}
          {cambios.length>0&&<details open={Boolean(h.antes)}><summary>{h.antes?`${cambios.length} datos actualizados`:'Ver datos del ingreso'}</summary><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-historial"><thead><tr><th>Dato</th>{h.antes&&<th>Antes</th>}<th>{h.antes?'Después':'Valor registrado'}</th></tr></thead><tbody>{cambios.map(c=><tr key={c.campo}><th scope="row">{c.campo}</th>{h.antes&&<td>{c.antes}</td>}<td>{c.despues}</td></tr>)}</tbody></table></div></details>}
        </article></li>;
      })}</ol>
    </section>
  </main>;
}
