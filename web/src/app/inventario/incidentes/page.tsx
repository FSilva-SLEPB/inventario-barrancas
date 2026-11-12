import Link from 'next/link';
import {exigirAcceso} from '@/lib/acceso';
import PanelFiltros from '@/components/panel-filtros';
import ListadoReportesIncidentes from '@/components/listado-reportes-incidentes';
import VentanaReporteIncidente from '@/components/ventana-reporte-incidente';
export default async function Incidentes({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirAcceso();const p=await searchParams,filtros=new URLSearchParams();for(const k of ['anio','parte','pagina','limite'])if(typeof p[k]==='string')filtros.set(k,p[k].slice(0,120));
 return <main><header><h1>Reportes y validación de TI</h1><p className="descripcion-pagina">Robos, sustracciones y daños de equipos y celulares. Los estados cambian tras la validación de TI.</p></header><Link className="btn btn-outline-primary" href="/inventario">Volver a Inventario</Link><PanelFiltros ruta="/inventario/incidentes" titulo="Filtrar reportes"><div className="campo-catalogos"><label htmlFor="reporte-anio">Año</label><input id="reporte-anio" name="anio" type="number" min="1900" max="9999" defaultValue={typeof p.anio==='string'?p.anio:''}/></div><div className="campo-catalogos"><label htmlFor="reporte-parte">Número de parte</label><input id="reporte-parte" name="parte" maxLength={120} defaultValue={typeof p.parte==='string'?p.parte:''}/></div></PanelFiltros><ListadoReportesIncidentes parametros={p} ruta="/inventario/incidentes"/><VentanaReporteIncidente parametros={p} volver={'/inventario/incidentes'+(filtros.size?'?'+filtros:'')}/></main>;
}
