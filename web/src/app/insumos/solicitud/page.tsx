import {exigirAcceso} from "@/lib/acceso";
import {requiereSede} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarCatalogoInsumos} from "@/lib/insumos";
import SolicitudForm from "../components/solicitud-form";
export const metadata={title:'Solicitud de insumos | SLEP Barrancas'};
export default async function SolicitudPage(){
 const actor=await exigirAcceso();
 const local=requiereSede(actor.rol);
 let catalogo=[] as Awaited<ReturnType<typeof listarCatalogoInsumos>>;
 try{catalogo=await listarCatalogoInsumos(true);}catch{}
 const sedes=await listarSedes().catch(()=>[] as Awaited<ReturnType<typeof listarSedes>>);
 return <main><SolicitudForm
  sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd,direccion:s.direccion,comuna:s.comuna}))}
  catalogo={catalogo}
  actor={{email:actor.email,sedeId:actor.sedeId??null,sedeNombre:actor.sedeNombre??null,sedeRbd:actor.sedeRbd??null}}
  local={local}
 /></main>;
}
