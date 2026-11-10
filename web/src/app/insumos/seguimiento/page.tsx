import {exigirAcceso} from "@/lib/acceso";
import {puedeAdministrar} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarStockInsumos,listarSolicitudesInsumos,obtenerSolicitudInsumo,type InsumoStock} from "@/lib/insumos";
import {esIdSede} from "@/lib/validacion-sedes";
import SolicitudesLista from "../components/solicitudes-lista";
export const metadata={title:'Seguimiento de insumos | SLEP Barrancas'};
export default async function SeguimientoPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirAcceso();const p=await searchParams;const admin=puedeAdministrar(actor.rol);
 const v=(k:string)=>typeof p[k]==='string'?(p[k] as string).trim():'';
 const filtroEstado=v('estado')||'activas';const filtroSede=v('sede')&&esIdSede(v('sede'))?v('sede'):'';const q=v('q').slice(0,150);
 const limite=[50,100,150].includes(Number(v('limite')))?Number(v('limite')):50;const pagina=/^[1-9]\d{0,6}$/.test(v('pagina'))?Number(v('pagina')):1;
 const ver=v('ver');const guardado=v('guardado')==='1';
 let stock:InsumoStock[]=[]; try{stock=await listarStockInsumos();}catch{}
 let solicitudesRes={filas:[],total:0,pagina:1,paginas:1} as Awaited<ReturnType<typeof listarSolicitudesInsumos>>;
 try{solicitudesRes=await listarSolicitudesInsumos({estado:filtroEstado,sede:filtroSede,q,pagina,limite});}catch{}
 const sedes=await listarSedes().catch(()=>[] as Awaited<ReturnType<typeof listarSedes>>);
 const detalle=ver?await obtenerSolicitudInsumo(ver).catch(()=>null):null;
 return <SolicitudesLista modo="seguimiento" ruta="/insumos/seguimiento" titulo="Seguimiento de insumos" descripcion="Revisa el estado y avance de las solicitudes en curso (solicitadas, en validación o aprobadas)." admin={admin} sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd}))} solicitudes={solicitudesRes.filas} stock={stock} total={solicitudesRes.total} pagina={solicitudesRes.pagina} paginas={solicitudesRes.paginas} limite={limite} filtroEstado={filtroEstado} filtroSede={filtroSede} q={q} detalle={detalle} guardado={guardado}/>;
}
