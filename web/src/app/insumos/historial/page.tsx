import {tienePermiso} from '@/lib/rbac';
import {obtenerParticipanteActual} from '@/lib/participante-actual';
import {exigirAcceso} from "@/lib/acceso";
import {puedeGestionarInsumos} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarStockInsumos,listarSolicitudesInsumos,obtenerSolicitudInsumo,type InsumoStock} from "@/lib/insumos";
import {esIdSede} from "@/lib/validacion-sedes";
import SolicitudesLista from "../components/solicitudes-lista";
export const metadata={title:'Historial de insumos | SLEP Barrancas'};
export default async function HistorialPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirAcceso('insumos');const p=await searchParams;const admin=puedeGestionarInsumos(actor);
 const v=(k:string)=>typeof p[k]==='string'?(p[k] as string).trim():'';
 const filtroEstado=v('estado');const filtroSede=v('sede')&&esIdSede(v('sede'))?v('sede'):'';const q=v('q').slice(0,150);
 const limite=[50,100,150].includes(Number(v('limite')))?Number(v('limite')):50;const pagina=/^[1-9]\d{0,6}$/.test(v('pagina'))?Number(v('pagina')):1;
 const ver=v('ver');
 const [stock,solicitudesRes]=await Promise.all([tienePermiso(actor,'stock_insumos')?listarStockInsumos():Promise.resolve([] as InsumoStock[]),listarSolicitudesInsumos({estado:filtroEstado,sede:filtroSede,q,pagina,limite})]);
 const sedes=await listarSedes();
 const detalle=ver?await obtenerSolicitudInsumo(ver):null;
 const emisor=admin&&detalle?await obtenerParticipanteActual():null;
 return <SolicitudesLista modo="historial" ruta="/insumos/historial" titulo="Historial de insumos" descripcion="Consulta el historial de solicitudes realizadas (entregadas, canceladas y todas)." paso={v('paso')} emisor={emisor} admin={admin} permisos={{aprobar:tienePermiso(actor,'seguimiento_insumos','aprobar'),confirmar:tienePermiso(actor,'seguimiento_insumos','confirmar')&&tienePermiso(actor,'actas_insumos','registrar'),actas:tienePermiso(actor,'actas_insumos'),descargar:tienePermiso(actor,'actas_insumos','descargar')}} sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd}))} solicitudes={solicitudesRes.filas} stock={stock} total={solicitudesRes.total} pagina={solicitudesRes.pagina} paginas={solicitudesRes.paginas} limite={limite} filtroEstado={filtroEstado} filtroSede={filtroSede} q={q} detalle={detalle}/>;
}
