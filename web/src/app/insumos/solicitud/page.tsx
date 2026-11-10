import {obtenerParticipanteActual} from '@/lib/participante-actual';
import {randomUUID} from 'node:crypto';
import {exigirGestionDependencias} from "@/lib/acceso";
import {requiereSede} from "@/lib/politica-acceso";
import {listarSedes} from "@/lib/sedes";
import {listarCatalogoInsumos} from "@/lib/insumos";
import SolicitudForm from "../components/solicitud-form";
export const metadata={title:'Solicitud de insumos | SLEP Barrancas'};
export default async function SolicitudPage(){
 const actor=await exigirGestionDependencias();
 const local=requiereSede(actor.rol);
 const [catalogo,participante]=await Promise.all([listarCatalogoInsumos(true),obtenerParticipanteActual()]);
 const sedes=await listarSedes();
 return <main><SolicitudForm solicitudId={randomUUID()}
  sedes={sedes.map(s=>({id:s.id,nombre:s.nombre,rbd:s.rbd,direccion:s.direccion,comuna:s.comuna}))}
  catalogo={catalogo}
  participante={participante}
  actor={{email:actor.email,sedeId:actor.sedeId??null,sedeNombre:actor.sedeNombre??null,sedeRbd:actor.sedeRbd??null}}
  local={local}
 /></main>;
}
