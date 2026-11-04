import AccionesRegistro from '@/components/acciones-registro';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {exigirGestionDependencias} from '@/lib/acceso';
import {puedeAdministrar} from '@/lib/politica-acceso';
import {esIdSede} from '@/lib/validacion-sedes';
import {detalleRobo} from '@/lib/robos';
import {ESTADOS_ROBO} from '@/lib/validacion-robos';
import {FormularioResolverRobo} from '@/components/formulario-robo';
export const metadata={title:'Incidente de robo | Inventario'};
export default async function IncidenteRobo({params}:{params:Promise<{id:string}>}){
 const actor=await exigirGestionDependencias(),{id}=await params;if(!esIdSede(id))notFound();const detalle=await detalleRobo(id);if(!detalle)notFound();
 const {incidente:i,equipos,historial}=detalle,admin=puedeAdministrar(actor.rol),hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const pendientes=equipos.filter(e=>!e.recuperadoFecha),estado=i.estado==='validado'&&!pendientes.length?'recuperado':i.estado;
 return <main><header><h1>Incidente de robo</h1><p className="descripcion-pagina">{i.rbd?i.rbd+' · ':''}{i.sedeNombre} · {i.comuna||'Sin comuna'}</p><p><Link href="/inventario/robos">Volver al consolidado</Link></p></header>
 <section className="ficha-seccion"><h2>{ESTADOS_ROBO[estado as keyof typeof ESTADOS_ROBO]}</h2><dl className="ficha-datos"><div><dt>Fecha del incidente</dt><dd>{i.fecha.split('-').reverse().join('/')}</dd></div><div><dt>Lugar</dt><dd>{i.lugar}</dd></div><div><dt>Reportado por</dt><dd>{i.reportadoPor}</dd></div><div><dt>Antecedentes</dt><dd className="texto-multilinea">{i.descripcion}</dd></div>{i.enlace&&<div><dt>Documentación</dt><dd><a href={i.enlace} target="_blank" rel="noopener noreferrer">Consultar antecedentes</a></dd></div>}</dl><p>{equipos.length} equipos asociados · {equipos.length-pendientes.length} recuperados.</p><p className="ayuda-catalogos">El incidente conserva la pertenencia de cada equipo y no genera una baja administrativa.</p></section>
 <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption>Identificación de los equipos al reportarse el incidente</caption><thead><tr><th>Equipo</th><th>Serie</th><th>Inventario</th><th>Recuperación</th><th>Acciones</th></tr></thead><tbody>{equipos.map(e=><tr key={e.equipoId}><td>{e.identificacion.categoria} · {e.identificacion.marca} {e.identificacion.modelo}</td><td>{e.identificacion.serie||'Pendiente'}</td><td>{e.identificacion.inventario||'Pendiente'}</td><td>{e.recuperadoFecha?e.recuperadoFecha.split('-').reverse().join('/'):'Sin recuperación registrada'}{e.motivo&&<p>{e.motivo}</p>}</td><td><AccionesRegistro nombre={'equipo '+(e.identificacion.inventario||e.identificacion.serie||e.equipoId)} verHref={'/inventario/'+e.equipoId}/></td></tr>)}</tbody></table></div>
 {admin&&i.estado==='reportado'&&<FormularioResolverRobo key={i.version} id={id} version={i.version} hoy={hoy} fechaIncidente={i.fecha}/>}
 {admin&&i.estado==='validado'&&pendientes.length>0&&<FormularioResolverRobo key={i.version} id={id} version={i.version} hoy={hoy} fechaIncidente={i.fecha} equipos={equipos}/>}
 <section><h2>Historial del incidente</h2><ol className="linea-historial">{historial.map(h=><li key={h.id}><article className="evento-historial"><div className="evento-cabecera"><strong>{h.evento==='recuperado'?'Recuperación registrada':ESTADOS_ROBO[h.evento as keyof typeof ESTADOS_ROBO]}</strong><time>{new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'}).format(new Date(h.fecha))}</time></div><p>{h.actor}</p><p className="texto-multilinea">{h.motivo}</p>{h.equipoId&&<Link href={'/inventario/'+h.equipoId}>Equipo recuperado</Link>}</article></li>)}</ol></section></main>;
}
