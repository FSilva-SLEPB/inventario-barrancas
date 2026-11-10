import {randomUUID} from 'node:crypto';
import {exigirAcceso} from "@/lib/acceso";
import {requiereSede} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarCatalogoInsumos} from "@/lib/insumos";
import SolicitudForm from "../components/solicitud-form";
export const metadata={title:'Solicitud de insumos | SLEP Barrancas'};
export default async function SolicitudPage(){
 const actor=await exigirAcceso();
 const local=requiereSede(actor.rol);
 const catalogo=await listarCatalogoInsumos(true);
 const sedes=await listarSedes();
 return <main><SolicitudForm solicitudId={randomUUID()}
  sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd,direccion:s.direccion,comuna:s.comuna}))}
  catalogo={catalogo}
  actor={{email:actor.email,sedeId:actor.sedeId??null,sedeNombre:actor.sedeNombre??null,sedeRbd:actor.sedeRbd??null}}
  local={local}
 /></main>;
}
