import {AccionesCustodia} from '@/components/ventana-movimiento';
import {CUSTODIAS} from '@/lib/validacion-movimientos-inventario';
import ModalFicha from '@/components/modal-ficha';
import {equipoEnVista} from '@/lib/ficha-inventario';
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar,puedeGestionarDependencias } from "@/lib/politica-acceso";
import { esIdSede } from "@/lib/validacion-sedes";
import { etiquetaSede } from "@/lib/etiqueta-sede";
import { obtenerEquipo,historialEquipo,equipoAFormulario,type Equipo } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { CAMPOS_COMPRA,CONDICIONES,ORIGENES,SITUACIONES } from "@/lib/validacion-equipos";
import { robosEquipo } from "@/lib/robos";
import { ESTADOS_ROBO } from "@/lib/validacion-robos";
import { cambiosHistorial } from "@/lib/presentacion-historial";
import FormularioEquipo from "@/components/formulario-equipo";
export type ContextoFichaEquipo={volver:string;verHref:string;editarHref:string;ambito:'nc'|'eeji';vista:string};
export default async function FichaEquipo({id,editar=false,guardado=false,contexto,equipo}:{id:string;editar?:boolean;guardado?:boolean;contexto?:ContextoFichaEquipo;equipo?:Equipo}){
  const actor=await exigirAcceso();if(!esIdSede(id))notFound();
  const e=equipo??await obtenerEquipo(id);if(!e||e.id!==id||(contexto&&!equipoEnVista(e,contexto.ambito,contexto.vista)))notFound();
  const [historial,categorias,robos]=await Promise.all([historialEquipo(id),listarCategorias(),robosEquipo(id)]);
  const editable=puedeGestionarDependencias(actor.rol)&&(puedeAdministrar(actor.rol)||e.custodia!=='en_bodega');
  const editando=editable&&editar;const sedes=editando?await listarSedes():[];
  const compra=Object.entries(CAMPOS_COMPRA).filter(([k])=>e.compra[k as keyof typeof CAMPOS_COMPRA]);
  const dato=(label:string,v:string|null|undefined)=><div key={label}><dt>{label}</dt><dd>{v||'Sin informar'}</dd></div>;
  const Contenedor=contexto?'div':'main',Titulo=contexto?'h3':'h1',SeccionHistorial=contexto?'details':'section';
  const verHref=contexto?.verHref??`/inventario/${id}`;
  const volver=contexto?.volver??`/inventario/${e.sedeTipo==='nivel_central'?'nivel-central':'p02'}?vista=${e.custodia==='en_bodega'?'pendientes':'inventario'}`;
  const formulario=<section id="editar-equipo" className="ficha-seccion"><h2>Editar información</h2><p><Link scroll={false} href={verHref}>Cancelar edición</Link></p><div id="formulario-equipo"><FormularioEquipo key={id} inicial={equipoAFormulario(e)} sedes={sedes} categorias={categorias} local={!puedeAdministrar(actor.rol)} volver={contexto?.volver}/></div></section>;
  return <Contenedor className="ficha-equipo"><header className="ficha-cabecera"><div><p className="etiqueta-ficha">Ficha e historial</p><Titulo>{e.categoriaNombre} · {e.marca} {e.modelo}</Titulo><p className="descripcion-pagina">{etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd})}</p></div>
    <div className="acciones-catalogos">{!editando&&<AccionesCustodia tipo="equipo" id={id} custodia={e.custodia} volver={volver} permitido={puedeAdministrar(actor.rol)&&!e.roboEstado}/>}
    {editable&&!editando&&<Link data-editar-ficha scroll={false} className="btn btn-outline-primary" href={contexto?.editarHref??`/inventario/${id}?editar=si`} aria-label="Editar información del equipo">✎ Editar información</Link>}
      <Link scroll={false} href={contexto?.volver??`/inventario/${e.sedeTipo==='nivel_central'?'nivel-central':'p02'}?vista=${e.custodia==='en_bodega'?'pendientes':'inventario'}`}>{contexto?'Cerrar ficha':'Volver al inventario'}</Link></div></header>
    {guardado&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
    {editando?(contexto?formulario:<ModalFicha titulo="Editar equipo" cerrarHref={verHref} editando>{formulario}</ModalFicha>)
    :<div className="ficha-secciones"><section className="ficha-seccion"><h2>Identificación</h2><dl className="ficha-datos">{dato('Categoría',e.categoriaNombre)}{dato('Marca',e.marca)}{dato('Modelo',e.modelo)}{dato('Número de serie',e.serie||'Pendiente')}{dato('Número de inventario',e.inventario||'Pendiente')}
      {(!e.serie||!e.inventario)&&e.motivoIdentificacion&&dato('Dato pendiente',e.motivoIdentificacion)}</dl></section>
      <section className="ficha-seccion"><h2>Entrega y funcionamiento</h2><dl className="ficha-datos">{dato('Inventario / sede',etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd}))}{dato('Estado',CUSTODIAS[e.custodia as keyof typeof CUSTODIAS])}{dato('Situación de entrega',SITUACIONES[e.situacion as keyof typeof SITUACIONES])}{dato('Origen',ORIGENES[e.origen])}{dato('Estado de funcionamiento',CONDICIONES[e.condicionTecnica])}
        {e.fechaEntrega&&dato('Fecha de entrega',e.fechaEntrega.split('-').reverse().join('/'))}{e.enlaceActa&&<div><dt>Acta existente</dt><dd><a href={e.enlaceActa} target="_blank" rel="noopener noreferrer">Consultar documento</a></dd></div>}</dl>
        <p className="ayuda-catalogos">El funcionamiento indica si está operativo o necesita reparación; no determina su entrega ni una baja.</p></section>
      {compra.length>0&&<section className="ficha-seccion ficha-adquisicion"><h2>Adquisición</h2><dl className="ficha-datos">{compra.map(([k,label])=>dato(label,e.compra[k as keyof typeof CAMPOS_COMPRA]))}</dl></section>}
      {(e.observaciones||e.archivoOrigen)&&<section className="ficha-seccion"><h2>Antecedentes</h2>{e.observaciones&&<p>{e.observaciones}</p>}{e.archivoOrigen&&<p>Archivo de origen: {e.archivoOrigen} · fila {e.filaOrigen}.</p>}</section>}
    </div>}
    {robos.length>0&&<section className="ficha-seccion"><h2>Incidentes de robo</h2><ul>{robos.map(r=><li key={r.id}>{r.fecha.split('-').reverse().join('/')} · {ESTADOS_ROBO[(r.recuperadoFecha?'recuperado':r.estado) as keyof typeof ESTADOS_ROBO]} {puedeGestionarDependencias(actor.rol)&&<Link href={'/inventario/robos/'+r.id}>Ver incidente</Link>}</li>)}</ul></section>}
    <SeccionHistorial id="historial" className="historial-equipo">{contexto?<summary>Historial del equipo</summary>:<h2>Historial del equipo</h2>}<p className="ayuda-catalogos">Registro de ingresos, entregas y actualizaciones, con fecha y responsable. Las ediciones conservan el valor anterior y el nuevo.</p>
      <ol className="linea-historial">{historial.map((h,i)=>{
        const cambios=cambiosHistorial(h.antes,h.despues,categorias);
        return <li key={i}><article className="evento-historial"><div className="evento-cabecera"><strong>{h.incidenteId?'Incidente de robo':h.entregaId?'Entrega registrada':h.antes?'Información actualizada':'Registro inicial'}</strong><time>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(h.registradoEn))}</time></div>
          <p className="evento-actor">{h.actor}</p><p>{h.motivo}</p>
          {h.entregaId&&puedeAdministrar(actor.rol)&&<p><Link href={`/inventario/movimientos/entregas/${h.entregaId}`}>Ver entrega y receptora</Link></p>}
          {h.incidenteId&&puedeGestionarDependencias(actor.rol)&&<p><Link href={'/inventario/robos/'+h.incidenteId}>Ver incidente y seguimiento</Link></p>}
          {cambios.length>0&&<details open={Boolean(h.antes)}><summary>{h.antes?`${cambios.length} datos actualizados`:'Ver datos del ingreso'}</summary><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-historial"><thead><tr><th>Dato</th>{h.antes&&<th>Antes</th>}<th>{h.antes?'Después':'Valor registrado'}</th></tr></thead><tbody>{cambios.map(c=><tr key={c.campo}><th scope="row">{c.campo}</th>{h.antes&&<td>{c.antes}</td>}<td>{c.despues}</td></tr>)}</tbody></table></div></details>}
        </article></li>;
      })}</ol>
    </SeccionHistorial>
  </Contenedor>;
}
