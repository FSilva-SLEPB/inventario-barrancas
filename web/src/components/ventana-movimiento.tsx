import Link from 'next/link';
import EnlaceAccion from '@/components/enlace-accion';
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
import FormularioMovimiento,{type FuncionarioMovimiento} from '@/components/formulario-movimiento-inventario';
export function AccionesCustodia({tipo,id,custodia,volver,permitido}:{tipo:TipoBien;id:string;custodia:string;volver:string;permitido:boolean}){
 if(!permitido)return null;const accion=custodia==='en_bodega'?'asignacion':'devolucion';return <EnlaceAccion href={enlaceMovimiento(volver,tipo,id,accion)} etiqueta={accion==='asignacion'?'Asignar / entregar':'Devolver a Bodega TI'} icono={accion==='asignacion'?'asignar':'devolver'}/>;
}
export default async function VentanaMovimiento({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 if(!parametros.movimiento)return null;const actor=await exigirAdministrador();
 const accion=parametros.movimiento,tipo=parametros.claseBien,id=parametros.bien;
 if(!['devolucion','asignacion'].includes(String(accion))||!['equipo','celular'].includes(String(tipo))||typeof id!=='string'||!esIdSede(id))notFound();
 const bien=tipo==='equipo'?await obtenerEquipo(id):(await detalleCelular(id))?.celular;if(!bien)notFound();const sedes=await listarSedes(),posible=accion==='devolucion'?bien.custodia==='asignado':bien.custodia==='en_bodega';
 const [directorio,usuario,personal,ultima]=await Promise.all([listarDirectorio(),obtenerBaseDatos().query<{nombre:string|null}>('SELECT nombre FROM public.usuarios_acceso WHERE correo=$1',[actor.email]),obtenerBaseDatos().query<FuncionarioMovimiento>('SELECT id,nombre,rut,correo,cargo,unidad,subdireccion FROM public.funcionarios_nc WHERE activo ORDER BY lower(nombre),id'),obtenerBaseDatos().query<{receptor:string;metadata:Record<string,string>}>("SELECT m.receptor,a.datos->'metadata' AS metadata FROM public.movimientos_inventario m LEFT JOIN public.actas_documentos a ON a.movimiento_id=m.id WHERE "+(tipo==='equipo'?'m.equipo_id':'m.celular_id')+"=$1 AND m.accion='asignacion' ORDER BY m.registrado_en DESC,m.id DESC LIMIT 1",[id])]),funcionarios=personal.rows,receptores=directorio.filter(d=>d.nombre&&['titular','subrogante'].includes(d.situacion??'')).map(d=>({sedeId:d.sedeId,nombre:d.nombre!,rut:d.rut??'',correo:d.correo??'',cargo:d.cargo||'Director/a'})),persona=receptores.find(d=>d.sedeId===bien.sedeId),propio=funcionarios.find(f=>f.correo?.toLowerCase()===actor.email),emisor={nombre:propio?.nombre||usuario.rows[0]?.nombre||actor.email,rut:propio?.rut??'',cargo:propio?.cargo||propio?.unidad||'UTIC',correo:actor.email},previo=ultima.rows[0],inicial={destino:accion==='asignacion'?bien.sedeId:'',fecha:hoyChile(),funcionario:'',receptor:accion==='asignacion'?persona?.nombre??'':emisor.nombre,motivo:'',entregaNombre:accion==='asignacion'?emisor.nombre:previo?.receptor||persona?.nombre||('responsable' in bien?bien.responsable:''),entregaRun:accion==='asignacion'?emisor.rut:previo?(previo.metadata?.recibeRun??''):(persona?.rut??''),entregaCargo:accion==='asignacion'?emisor.cargo:previo?(previo.metadata?.recibeCargo??''):(persona?.cargo??''),entregaCorreo:accion==='asignacion'?emisor.correo:previo?(previo.metadata?.recibeCorreo??''):(persona?.correo??''),recibeRun:accion==='asignacion'?persona?.rut??'':emisor.rut,recibeCorreo:accion==='asignacion'?persona?.correo??'':emisor.correo,recibeCargo:accion==='asignacion'?persona?.cargo??'':emisor.cargo,recibeUnidad:'',recibeSubdireccion:''};
 return <ModalFicha titulo={accion==='devolucion'?'Devolver a Bodega TI':'Asignar desde Bodega TI'} cerrarHref={volver} editando focoId={id}><h3>{bien.marca} {bien.modelo}</h3><p>{'telefono' in bien?bien.telefono:bien.inventario||bien.serie} · {CUSTODIAS[bien.custodia as keyof typeof CUSTODIAS]}</p>{posible?<FormularioMovimiento tipo={tipo as TipoBien} bienId={id} version={bien.version} accion={accion as 'devolucion'|'asignacion'} solicitud={randomUUID()} actaSolicitud={randomUUID()} inicial={inicial} receptores={receptores} funcionarios={funcionarios} emisor={emisor.nombre+' · '+actor.email} sedeOrigen={bien.sedeId} sedes={sedes} volver={volver} hoy={hoyChile()}/>:<><p role="alert">El estado del bien cambió. Vuelve al listado y revisa su ficha.</p><Link href={volver}>Volver al listado</Link></>}</ModalFicha>;
}
