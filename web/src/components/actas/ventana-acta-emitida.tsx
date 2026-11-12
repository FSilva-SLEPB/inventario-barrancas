import {exigirAcceso} from '@/lib/acceso';
import {tienePermiso} from '@/lib/rbac';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {obtenerActa} from '@/lib/actas';
import {folioActa} from '@/lib/validacion-actas';
import ModalFicha from '@/components/modal-ficha';
import AccionesDocumento from '@/components/actas/acciones-documento';
export default async function VentanaActaEmitida({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 if(!parametros.acta)return null;if(typeof parametros.acta!=='string')notFound();const a=await obtenerActa(parametros.acta);if(!a)notFound();
 const actor=await exigirAcceso(),recurso=a.datos.tipo==='entrega_insumo'?'actas_insumos':'actas';
 return <ModalFicha titulo={'Acta '+folioActa(a.folio)} cerrarHref={volver}><p>{a.datos.sedeNombre} · Recibe: {a.datos.receptorNombre}</p><AccionesDocumento id={a.id} enviar={tienePermiso(actor,recurso,'enviar')} imprimir={tienePermiso(actor,recurso,'imprimir')} descargar={tienePermiso(actor,recurso,'descargar')} correoHref={'/inventario/actas/'+a.id+'?'+new URLSearchParams({correo:'si',volver})}/><p><Link href={volver}>Volver al inventario</Link> · <Link href={'/inventario/actas/'+a.id+'?'+new URLSearchParams({volver})}>Ver acta e historial de envíos</Link></p></ModalFicha>;
}
