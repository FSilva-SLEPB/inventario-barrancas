import {exigirAcceso} from "@/lib/acceso";
import {puedeAdministrar,puedeGestionarDependencias,requiereSede} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarCatalogoInsumos,listarStockInsumos,listarSolicitudesInsumos,obtenerSolicitudInsumo,type InsumoStock} from "@/lib/insumos";
import {esIdSede} from "@/lib/validacion-sedes";
import InsumosClient from "./components/insumos-client";
export const metadata={title:'Solicitudes de insumos | SLEP Barrancas'};
export default async function InsumosPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirAcceso();const p=await searchParams;const local=requiereSede(actor.rol);const admin=puedeAdministrar(actor.rol);
 const puedeSolicitar=admin||puedeGestionarDependencias(actor.rol)||requiereSede(actor.rol)||(actor.rol as string)==='consulta_sede';
 const v=(k:string)=>typeof p[k]==='string'?(p[k] as string).trim():'';
 const filtroEstado=v('estado');const filtroSede=v('sede')&&esIdSede(v('sede'))?v('sede'):'';const q=v('q').slice(0,150);
 const limite=[50,100,150].includes(Number(v('limite')))?Number(v('limite')):50;const pagina=/^[1-9]\d{0,6}$/.test(v('pagina'))?Number(v('pagina')):1;
 const ver=v('ver');const guardado=v('guardado')==='1';
 let stock:InsumoStock[]=[];let catalogo=[] as Awaited<ReturnType<typeof listarCatalogoInsumos>>;
 try{[catalogo,stock]=await Promise.all([listarCatalogoInsumos(admin?false:true),listarStockInsumos()]);}catch{}
 let solicitudesRes={filas:[],total:0,pagina:1,paginas:1} as Awaited<ReturnType<typeof listarSolicitudesInsumos>>;
 try{solicitudesRes=await listarSolicitudesInsumos({estado:filtroEstado,sede:filtroSede,q,pagina,limite});}catch{}
 const sedes=await listarSedes().catch(()=>[] as Awaited<ReturnType<typeof listarSedes>>);
 const detalle=ver?await obtenerSolicitudInsumo(ver).catch(()=>null):null;
 return <InsumosClient local={local} admin={admin} puedeSolicitar={puedeSolicitar}
  sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd}))}
  catalogo={catalogo} stock={stock}
  solicitudes={solicitudesRes.filas} total={solicitudesRes.total}
  pagina={solicitudesRes.pagina} paginas={solicitudesRes.paginas} limite={limite}
  filtroEstado={filtroEstado} filtroSede={filtroSede} q={q}
  detalle={detalle} guardado={guardado}
 />;
}
