import {randomUUID} from 'node:crypto';
import {detalleUbicacionBodega,listarUbicacionesBodega} from '@/lib/ubicaciones-bodega';
import ModalFicha from '@/components/modal-ficha';
import FormularioUbicacionBodega from '@/components/formulario-ubicacion-bodega';
export default async function VentanaUbicacionBodega({id,tipo,volver}:{id:string;tipo:'equipo'|'celular';volver:string}){
 if(!id)return null;
 const bien=await detalleUbicacionBodega(tipo,id);if(!bien)return <ModalFicha titulo="Ubicación de Bodega TI" cerrarHref={volver}><p>El bien no está disponible.</p></ModalFicha>;
 const ubicaciones=await listarUbicacionesBodega(),puede= bien.custodia==='en_bodega'&&bien.administrativo==='activo'&&bien.activo&&!bien.incidente;
 return <ModalFicha titulo="Ubicación de Bodega TI" cerrarHref={volver} focoId={id} editando={puede}><h3>{bien.marca} {bien.modelo}</h3><p>{bien.identificador} · Ubicación registrada: {bien.ubicacionNombre}</p>
 {puede?<FormularioUbicacionBodega tipo={tipo} id={id} version={bien.version} ubicacion={bien.ubicacion} ubicaciones={ubicaciones} solicitud={randomUUID()} volver={volver}/>:<p role="status">El estado o la custodia del bien no permiten modificar su ubicación. Se conserva el historial.</p>}
 <details className="directorio-historial"><summary>Últimas 30 confirmaciones de ubicación</summary><ol>{bien.historial.map(h=><li key={h.id}>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(h.fecha))} · {h.actor}: {h.antes} → {h.despues}</li>)}</ol>{!bien.historial.length&&<p>No hay confirmaciones anteriores.</p>}</details></ModalFicha>;
}
