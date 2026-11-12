import {notFound} from 'next/navigation';
import {exigirAlguno} from '@/lib/acceso';
import {puedeAdministrar} from '@/lib/politica-acceso';
import {listarSedes} from '@/lib/sedes';
import {esIdSede} from '@/lib/validacion-sedes';
import {bienesParaReporte,obtenerReporteIncidente} from '@/lib/reportes-incidentes';
import ModalFicha from '@/components/modal-ficha';
import FormularioReporteIncidente from '@/components/formulario-reporte-incidente';
export default async function VentanaReporteIncidente({parametros,volver}:{parametros:Record<string,string|string[]|undefined>;volver:string}){
 const id=parametros.reporte;if(typeof id!=='string')return null;if(id!=='nuevo'&&!esIdSede(id))notFound();
 const a=await exigirAlguno('incidentes.registrar','incidentes.editar','incidentes.aprobar'),[sedes,bienes,detalle]=await Promise.all([listarSedes(),bienesParaReporte(),id==='nuevo'?null:obtenerReporteIncidente(id)]);if(id!=='nuevo'&&!detalle)notFound();
 return <ModalFicha titulo={id==='nuevo'?'Reportar incidente':detalle?.reporte.estado==='borrador'?'Completar reporte':'Reporte y validación de TI'} cerrarHref={volver} editando><FormularioReporteIncidente key={id} reporte={detalle?.reporte} bienes={bienes} sedes={sedes} volver={volver} admin={puedeAdministrar(a)} preseleccion={typeof parametros.bien==='string'?parametros.bien:undefined}/>{detalle&&<><h3>Archivos del reporte</h3>{!detalle.adjuntos.length&&<p>Pendiente de informe.</p>}<ul>{detalle.adjuntos.map(x=><li key={x.id}><a href={'/api/inventario/incidentes/adjuntos?id='+x.id}>{x.nombre}</a></li>)}</ul>{detalle.reporte.motivo_validacion&&<p>Revisión de TI: {detalle.reporte.motivo_validacion}</p>}</>}</ModalFicha>;
}
