import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {exigirGestionDependencias} from '@/lib/acceso';
import {listarSedes} from '@/lib/sedes';
import {esIdSede} from '@/lib/validacion-sedes';
import {etiquetaSede} from '@/lib/etiqueta-sede';
import {equiposParaRobo} from '@/lib/robos';
import {FormularioReporteRobo} from '@/components/formulario-robo';
export const metadata={title:'Reportar robo de equipos | Inventario'};
export default async function ReportarRobo({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirGestionDependencias();const p=await searchParams,sedes=(await listarSedes()).filter(s=>s.activo);
 const sede=typeof p.sede==='string'&&esIdSede(p.sede)&&sedes.some(s=>s.id===p.sede)?p.sede:'';
 const q=typeof p.q==='string'?p.q.trim().slice(0,150):'',equipos=sede?await equiposParaRobo(sede,q):[];
 const hoy=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <main><header><h1>Reportar robo</h1><p className="descripcion-pagina">Identifica los equipos afectados de un mismo establecimiento, JISC o Nivel Central. El reporte se revisa antes de validarse.</p><p><Link href="/inventario/robos">Volver al consolidado de robos</Link></p></header>
 <form method="get" className="filtros-catalogos"><div className="campo-catalogos"><label htmlFor="robo-sede">Establecimiento / JISC / Nivel Central</label><select id="robo-sede" name="sede" defaultValue={sede} required><option value="">Selecciona una sede</option>{sedes.map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select></div><div className="campo-catalogos"><label htmlFor="robo-busqueda">Buscar equipo, serie o inventario</label><input id="robo-busqueda" name="q" defaultValue={q} maxLength={150}/></div><button className="boton-catalogos" type="submit">Mostrar equipos</button></form>
 {equipos.length>200&&<p role="status">Se muestran los primeros 200 equipos. Precisa la búsqueda para encontrar los afectados.</p>}
 {sede&&<section><h2>{etiquetaSede(sedes.find(s=>s.id===sede)!)}</h2><FormularioReporteRobo key={sede+'|'+q} sede={sede} solicitud={randomUUID()} equipos={equipos.slice(0,200)} hoy={hoy}/></section>}</main>;
}
