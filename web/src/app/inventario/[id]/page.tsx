import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar,puedeGestionarDependencias } from "@/lib/politica-acceso";
import { esIdSede } from "@/lib/validacion-sedes";
import { etiquetaSede } from "@/lib/etiqueta-sede";
import { obtenerEquipo,historialEquipo,equipoAFormulario } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { CAMPOS_COMPRA,CONDICIONES,ORIGENES,SITUACIONES } from "@/lib/validacion-equipos";
import FormularioEquipo from "@/components/formulario-equipo";
export const metadata={title:"Ficha del equipo | Inventario"};
const etiquetas:Record<string,string>={marca:"Marca",modelo:"Modelo",serie:"Serie",numero_inventario:"Número de inventario",
  motivo_identificacion:"Motivo de identificación pendiente",categoria_id:"Categoría",condicion_tecnica:"Condición técnica",observaciones:"Observaciones",datos_compra:"Datos de adquisición"};
export default async function FichaEquipo({params}:{params:Promise<{id:string}>}) {
  const actor=await exigirAcceso();const {id}=await params;if(!esIdSede(id))notFound();
  const e=await obtenerEquipo(id);if(!e)notFound();
  const [historial,categorias]=await Promise.all([historialEquipo(id),listarCategorias()]);
  const editable=puedeGestionarDependencias(actor.rol)&&(puedeAdministrar(actor.rol)||e.situacion!=="pendiente_entrega");
  const sedes=editable?await listarSedes():[];
  const representar=(k:string,v:unknown):string=>{
    if(v===null||v===undefined||v==="")return "Sin dato";
    if(k==="condicion_tecnica")return CONDICIONES[v as keyof typeof CONDICIONES]??String(v);
    if(k==="categoria_id")return categorias.find(c=>c.id===v)?.nombre??"Categoría no disponible";
    if(k==="datos_compra"&&typeof v==="object")return Object.entries(v).filter(([,dato])=>dato).map(([c,dato])=>`${CAMPOS_COMPRA[c as keyof typeof CAMPOS_COMPRA]??c}: ${dato}`).join("; ")||"Sin datos informados";
    return String(v);
  };
  return <main><h1>Ficha del equipo</h1><p><Link href={`/inventario/${e.sedeTipo==="nivel_central"?"nivel-central":"p02"}?vista=${e.situacion==="pendiente_entrega"?"pendientes":"inventario"}`}>Volver al inventario</Link></p>
    <dl><dt>Sede</dt><dd>{etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd})}</dd>
      <dt>Equipo</dt><dd>{e.categoriaNombre} · {e.marca} {e.modelo}</dd>
      <dt>Serie</dt><dd>{e.serie||"Pendiente"}</dd><dt>Número de inventario</dt><dd>{e.inventario||"Pendiente"}</dd>
      {e.motivoIdentificacion&&<><dt>Identificación pendiente</dt><dd>{e.motivoIdentificacion}</dd></>}
      <dt>Situación</dt><dd>{SITUACIONES[e.situacion as keyof typeof SITUACIONES]}</dd>
      <dt>Condición técnica</dt><dd>{CONDICIONES[e.condicionTecnica]}</dd><dt>Origen</dt><dd>{ORIGENES[e.origen]}</dd>
      {Object.entries(CAMPOS_COMPRA).map(([k,label])=>e.compra[k as keyof typeof CAMPOS_COMPRA]&&<div key={k}><dt>{label}</dt><dd>{e.compra[k as keyof typeof CAMPOS_COMPRA]}</dd></div>)}
      <dt>Fecha de entrega histórica</dt><dd>{e.fechaEntrega??"No informada"}</dd>
      <dt>Acta histórica</dt><dd>{e.enlaceActa?<a href={e.enlaceActa} target="_blank" rel="noopener noreferrer">Consultar documento</a>:"Sin enlace informado"}</dd>
      <dt>Observaciones</dt><dd>{e.observaciones||"Sin observaciones"}</dd></dl>
    {e.archivoOrigen&&<p>Registro de origen: {e.archivoOrigen} · fila {e.filaOrigen}.</p>}
    {editable&&<section id="formulario-equipo" className="panel-catalogos"><h2>Corregir datos</h2>
      <FormularioEquipo inicial={equipoAFormulario(e)} sedes={sedes} categorias={categorias} local={!puedeAdministrar(actor.rol)}/></section>}
    <section id="historial"><h2>Historial del equipo</h2>{historial.map((h,i)=><article key={i} className="panel-catalogos">
      <p>{new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short",timeZone:"America/Santiago"}).format(new Date(h.registradoEn))} · {h.actor}</p><p>{h.motivo}</p>
      <dl>{Object.entries(etiquetas).filter(([k])=>!h.antes||JSON.stringify(h.despues[k])!==JSON.stringify(h.antes[k])).map(([k,label])=><div key={k}>
        <dt>{label}</dt><dd>{h.antes?`${representar(k,h.antes[k])} → `:""}{representar(k,h.despues[k])}</dd></div>)}</dl>
    </article>)}</section>
  </main>;
}
