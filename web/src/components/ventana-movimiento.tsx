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
import {listarDirectorio} from '@/lib/directorio';
import {obtenerBaseDatos} from '@/lib/db';
import FormularioMovimiento from '@/components/formulario-movimiento-inventario';
export function AccionesCustodia({tipo,id,custodia,volver,permitido}:{tipo:TipoBien;id:string;custodia:string;volver:string;permitido:boolean}){
 if(!permitido)return null;const accion=custodia==='en_bodega'?'asignacion':'devolucion';return <Link scroll={false} className="btn btn-outline-primary" href={enlaceMovimiento(volver,tipo,id,accion)}>{accion==='asignacion'?'Asignar / entregar':'Devolver a Bodega TI'}</Link>;
}
export default async function VentanaMovimiento({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 if(!parametros.movimiento)return null;const actor=await exigirAdministrador();
 const accion=parametros.movimiento,tipo=parametros.claseBien,id=parametros.bien;
 if(!['devolucion','asignacion'].includes(String(accion))||!['equipo','celular'].includes(String(tipo))||typeof id!=='string'||!esIdSede(id))notFound();
 const bien=tipo==='equipo'?await obtenerEquipo(id):(await detalleCelular(id))?.celular;if(!bien)notFound();const sedes=await listarSedes(),posible=accion==='devolucion'?bien.custodia==='asignado':bien.custodia==='en_bodega';
 const [directorio,usuario]=await Promise.all([listarDirectorio(),obtenerBaseDatos().query<{nombre:string|null}>('SELECT nombre FROM public.usuarios_acceso WHERE correo=$1',[actor.email])]),receptores=directorio.filter(d=>d.nombre&&['titular','subrogante'].includes(d.situacion??'')).map(d=>({sedeId:d.sedeId,nombre:d.nombre!,rut:d.rut??'',correo:d.correo??''})),persona=receptores.find(d=>d.sedeId===bien.sedeId),inicial={destino:accion==='asignacion'?bien.sedeId:'',fecha:hoyChile(),receptor:accion==='asignacion'?persona?.nombre??'':usuario.rows[0]?.nombre??'',motivo:'',entregaNombre:accion==='asignacion'?usuario.rows[0]?.nombre??'':'',entregaCorreo:accion==='asignacion'?actor.email:'',recibeRun:accion==='asignacion'?persona?.rut??'':'',recibeCorreo:accion==='asignacion'?persona?.correo??'':actor.email,recibeCargo:accion==='asignacion'&&persona?'Director/a':accion==='devolucion'?'UTIC':''};
 return <ModalFicha titulo={accion==='devolucion'?'Devolver a Bodega TI':'Asignar desde Bodega TI'} cerrarHref={volver} editando focoId={id}><h3>{bien.marca} {bien.modelo}</h3><p>{'telefono' in bien?bien.telefono:bien.inventario||bien.serie} · {CUSTODIAS[bien.custodia as keyof typeof CUSTODIAS]}</p>{posible?<FormularioMovimiento tipo={tipo as TipoBien} bienId={id} version={bien.version} accion={accion as 'devolucion'|'asignacion'} solicitud={randomUUID()} actaSolicitud={randomUUID()} inicial={inicial} receptores={receptores} sedes={sedes} volver={volver} hoy={hoyChile()}/>:<><p role="alert">El estado del bien cambió. Vuelve al listado y revisa su ficha.</p><Link href={volver}>Volver al listado</Link></>}</ModalFicha>;
}
