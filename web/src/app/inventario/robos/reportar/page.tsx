import PanelFiltros from '@/components/panel-filtros';
import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {exigirGestionDependencias} from '@/lib/acceso';
import {requiereSede} from '@/lib/politica-acceso';
import {listarSedes} from '@/lib/sedes';
import {esIdSede} from '@/lib/validacion-sedes';
import {etiquetaSede} from '@/lib/etiqueta-sede';
import {equiposParaRobo} from '@/lib/robos';
import {FormularioReporteRobo} from '@/components/formulario-robo';
export const metadata={title:'Reportar robo de equipos | Inventario'};
export default async function ReportarRobo({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirGestionDependencias(),p=await searchParams,sedes=(await listarSedes()).filter(s=>s.activo),local=requiereSede(actor.rol);
 const sede=typeof p.sede==='string'&&esIdSede(p.sede)&&sedes.some(s=>s.id===p.sede)?p.sede:local&&sedes.length===1?sedes[0].id:'';
 const q=typeof p.q==='string'?p.q.trim().slice(0,150):'',equipo=typeof p.equipo==='string'&&esIdSede(p.equipo)?p.equipo:null;
 const buscar=Boolean(sede||q||equipo),equipos=buscar?await equiposParaRobo(sede||null,q,equipo):[];
 const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main><header><h1>Reportar robo</h1><p className="descripcion-pagina">Busca el equipo, selecciónalo e indica la fecha y qué ocurrió. Puedes incluir varios equipos de una misma sede.</p><p><Link href="/inventario/robos">Volver al consolidado de robos</Link></p></header>
 <PanelFiltros ruta="/inventario/robos/reportar" titulo="Filtrar equipos" busqueda={{id:'robo-busqueda',valor:q,placeholder:'Buscar por serie, inventario, marca o modelo'}}><div className="campo-catalogos"><label htmlFor="robo-sede">Establecimiento / sede {local?'':'(opcional)'}</label><select id="robo-sede" name="sede" defaultValue={sede}><option value="">Todos los autorizados</option>{sedes.map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select></div></PanelFiltros>
 {!buscar&&<p className="estado-modulo">Escribe la identificación del equipo o elige un establecimiento para ver sus equipos.</p>}
 {equipos.length>50&&<p role="status">Se muestran los primeros 50 equipos. Precisa la búsqueda para encontrar los afectados.</p>}
 {buscar&&<section><h2>Equipos encontrados</h2><FormularioReporteRobo key={sede+'|'+q+'|'+equipo} sede={sede} solicitud={randomUUID()} equipos={equipos.slice(0,50)} hoy={hoy} iniciales={equipo?[equipo]:[]}/></section>}</main>;
}
