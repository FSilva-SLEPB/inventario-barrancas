import Link from 'next/link';
import {notFound} from 'next/navigation';
import {detalleEntrega} from '@/lib/entregas';
export const metadata={title:'Detalle de entrega | Inventario'};
export default async function Entrega({params}:{params:Promise<{id:string}>}){
 const {id}=await params,e=await detalleEntrega(id);if(!e)notFound();
 const dato=(label:string,valor:string|null|undefined)=><div key={label}><dt>{label}</dt><dd>{valor||'No informado al registrar'}</dd></div>;
 return <main><header><h1>Entrega regularizada</h1><p><Link href="/inventario/movimientos">Volver a Movimientos y actas</Link></p></header>
 <div className="ficha-secciones"><section className="ficha-seccion"><h2>Establecimiento y entrega</h2><dl className="ficha-datos">{dato('Jardín / RBD',(e.rbd?e.rbd+' · ':'')+e.sedeNombre)}{dato('Comuna',e.comuna)}{dato('Dirección',e.sedeDatos.direccion)}{dato('Correo institucional',e.sedeDatos.correoInstitucional)}{dato('Fecha real de entrega',e.fecha.split('-').reverse().join('/'))}</dl></section>
 <section className="ficha-seccion"><h2>Persona que recibió</h2><dl className="ficha-datos">{dato('Directora receptora',e.receptora)}{dato('Cargo',e.cargo)}{dato('RUN',e.receptorDatos.rut)}{dato('Correo de contacto',e.receptorDatos.correo)}</dl><p className="ayuda-catalogos">Estos datos se conservaron al registrar la entrega. Cambiar el directorio no los modifica.</p></section></div>
 <section className="ficha-seccion"><h2>Antecedentes</h2><p>Registrado el {new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(e.registrado))} · {e.actor}</p><p>Acta existente sin folio informado. {e.enlace&&<a href={e.enlace} target="_blank" rel="noopener noreferrer">Consultar documento</a>}</p></section>
 <div className="tabla-usuarios-contenedor"><table className="tabla-catalogos"><caption>{e.items.length} equipos entregados · datos conservados al confirmar</caption><thead><tr><th scope="col">Equipo</th><th scope="col">Serie</th><th scope="col">Inventario</th><th scope="col">Historial</th></tr></thead><tbody>{e.items.map(item=><tr key={item.id}><td>{String(item.despues.marca)} {String(item.despues.modelo)}</td><td>{String(item.despues.serie??'Pendiente')}</td><td>{String(item.despues.numero_inventario??'Pendiente')}</td><td><Link href={`/inventario/${item.id}#historial`}>Ver historial</Link></td></tr>)}</tbody></table></div></main>;
}
