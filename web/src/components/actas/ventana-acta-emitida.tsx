import Link from 'next/link';
import {notFound} from 'next/navigation';
import {obtenerActa} from '@/lib/actas';
import {folioActa} from '@/lib/validacion-actas';
import ModalFicha from '@/components/modal-ficha';
import AccionesDocumento from '@/components/actas/acciones-documento';
export default async function VentanaActaEmitida({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 if(!parametros.acta)return null;if(typeof parametros.acta!=='string')notFound();const a=await obtenerActa(parametros.acta);if(!a)notFound();
 return <ModalFicha titulo={'Acta '+folioActa(a.folio)} cerrarHref={volver}><p>{a.datos.sedeNombre} · Recibe: {a.datos.receptorNombre}</p><AccionesDocumento id={a.id} correoHref={'/inventario/actas/'+a.id+'?correo=si'}/><p><Link href={volver}>Volver al inventario</Link> · <Link href={'/inventario/actas/'+a.id}>Ver acta e historial de envíos</Link></p></ModalFicha>;
}
