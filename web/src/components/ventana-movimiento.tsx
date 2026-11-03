import Link from 'next/link';
import {notFound} from 'next/navigation';
import {randomUUID} from 'node:crypto';
import {exigirAdministrador} from '@/lib/acceso';
import {esIdSede} from '@/lib/validacion-sedes';
import {obtenerEquipo} from '@/lib/equipos';
import {detalleCelular} from '@/lib/celulares';
import {listarSedes} from '@/lib/sedes';
import {hoyChile} from '@/lib/validacion-entregas';
import {CUSTODIAS,enlaceMovimiento,type TipoBien} from '@/lib/validacion-movimientos-inventario';
import ModalFicha from '@/components/modal-ficha';
import FormularioMovimiento from '@/components/formulario-movimiento-inventario';
export function AccionesCustodia({tipo,id,custodia,volver,permitido}:{tipo:TipoBien;id:string;custodia:string;volver:string;permitido:boolean}){
 if(!permitido)return null;const accion=custodia==='en_bodega'?'asignacion':'devolucion';return <Link scroll={false} className="btn btn-outline-primary" href={enlaceMovimiento(volver,tipo,id,accion)}>{accion==='asignacion'?'Asignar desde Bodega TI':'Devolver a Bodega TI'}</Link>;
}
export default async function VentanaMovimiento({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 if(!parametros.movimiento)return null;await exigirAdministrador();
 const accion=parametros.movimiento,tipo=parametros.claseBien,id=parametros.bien;
 if(!['devolucion','asignacion'].includes(String(accion))||!['equipo','celular'].includes(String(tipo))||typeof id!=='string'||!esIdSede(id))notFound();
 const bien=tipo==='equipo'?await obtenerEquipo(id):(await detalleCelular(id))?.celular;if(!bien)notFound();const sedes=await listarSedes(),posible=accion==='devolucion'?bien.custodia==='asignado':bien.custodia==='en_bodega';
 return <ModalFicha titulo={accion==='devolucion'?'Devolver a Bodega TI':'Asignar desde Bodega TI'} cerrarHref={volver} editando focoId={id}><h3>{bien.marca} {bien.modelo}</h3><p>{'telefono' in bien?bien.telefono:bien.inventario||bien.serie} · {CUSTODIAS[bien.custodia as keyof typeof CUSTODIAS]}</p>{posible?<FormularioMovimiento tipo={tipo as TipoBien} bienId={id} version={bien.version} accion={accion as 'devolucion'|'asignacion'} solicitud={randomUUID()} sedes={sedes} volver={volver} hoy={hoyChile()}/>:<><p role="alert">El estado del bien cambió. Vuelve al listado y revisa su ficha.</p><Link href={volver}>Volver al listado</Link></>}</ModalFicha>;
}
