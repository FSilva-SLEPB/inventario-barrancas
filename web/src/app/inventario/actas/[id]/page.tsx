import {retornoMovimiento,enlaceActaInventario} from '@/lib/validacion-movimientos-inventario';
import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {notFound} from 'next/navigation';
import {obtenerActa,enviosActa,ESTADOS_ENVIO} from '@/lib/actas';
import {folioActa,TIPOS_ACTA} from '@/lib/validacion-actas';
import {correoActasDisponible} from '@/lib/correo-actas';
import AccionesDocumento from '@/components/actas/acciones-documento';
import FormularioCorreoActa from '@/components/actas/formulario-correo-acta';
import ModalFicha from '@/components/modal-ficha';
export const metadata={title:'Registro del acta | Inventario'};
export default async function FichaActa({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params,p=await searchParams,a=await obtenerActa(id);if(!a)notFound();const envios=await enviosActa(id),retorno=retornoMovimiento(typeof p.volver==='string'?p.volver:''),ruta='/inventario/actas/'+id,volver=retorno?enlaceActaInventario(retorno,id):ruta;
 return <main><header><h1>{folioActa(a.folio)}</h1><p className="descripcion-pagina">Acta de {TIPOS_ACTA[a.datos.tipo].toLocaleLowerCase('es')} · Versión {a.version} · Fecha de la operación {a.datos.fecha.split('-').reverse().join('/')}</p><p><Link href={retorno??'/inventario/actas'}>{retorno?'Volver al inventario':'Volver a Actas emitidas'}</Link></p></header><p>{a.datos.sedeNombre} · Recibe: {a.datos.receptorNombre}</p>{a.entregaId&&<p className="ayuda-catalogos">Emitida desde la entrega histórica registrada. No modifica su fecha ni registra otra asignación.</p>}<AccionesDocumento id={id} correoHref={ruta+'?'+new URLSearchParams({correo:'si',...(retorno?{volver:retorno}:{})})}/><details className="directorio-historial"><summary>Historial de envíos por correo</summary><p className="ayuda-catalogos">Se muestra el resultado informado por el servicio de correo; no confirma lectura ni llegada a la bandeja del destinatario.</p><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th>Fecha</th><th>Destinatarios</th><th>Resultado</th><th>Registrado por</th></tr></thead><tbody>{envios.map(e=><tr key={e.id}><td>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(e.creadoEn))}</td><td>{e.destinatarios.join(', ')}</td><td>{ESTADOS_ENVIO[e.estado]}</td><td>{e.actor}</td></tr>)}{!envios.length&&<tr><td colSpan={4}>Esta acta aún no tiene envíos registrados.</td></tr>}</tbody></table></div></details>
 {p.correo==='si'&&<ModalFicha titulo="Enviar acta por correo" cerrarHref={volver} editando><FormularioCorreoActa id={id} solicitud={randomUUID()} retorno={retorno??undefined} destinatario={a.datos.metadata.recibeCorreo} cancelarHref={volver} disponible={correoActasDisponible()} revisar={envios.some(e=>e.estado==='no_confirmado')}/></ModalFicha>}</main>;
}
