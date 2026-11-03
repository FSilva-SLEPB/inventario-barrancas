import {esIdSede} from '@/lib/validacion-sedes';
import {ESTADOS_ROBO,fechaRobo} from '@/lib/validacion-robos';
import type {FiltrosRobos} from '@/lib/robos';

export type ConteosRobos={equipos:number;incidentes:number;robados:number;reportados:number;recuperados:number;rechazados:number};
export type GrupoDashboard=ConteosRobos&{clave:string;nombre:string;rbd?:string|null;comunas?:string|null};
export type PeriodoDashboard={periodo:string;etiqueta:string;incidentes:number;equipos:number};
export type DatosDashboardRobos={resumen:ConteosRobos;sedes:GrupoDashboard[];comunas:GrupoDashboard[];categorias:GrupoDashboard[];serie:PeriodoDashboard[];unidad:'month'|'year';consultado:string};
export type MetricaRobo='robados'|'reportados'|'recuperados';
export const METRICAS_ROBO:Record<MetricaRobo,string>={robados:'Robo validado sin recuperar',reportados:'Pendiente de validación',recuperados:'Con recuperación registrada'};
export type BusquedaDashboard=Record<string,string|string[]|undefined>;
export function filtrosDashboardRobos(p:BusquedaDashboard,local:boolean,hoy:string){
 const valor=(k:string,max=150)=>typeof p[k]==='string'?p[k].trim().slice(0,max):'';
 const [y,m]=hoy.split('-').map(Number),inicio=new Date(Date.UTC(y,m-12,1)).toISOString().slice(0,10);
 const desde=p.desde===undefined?inicio:valor('desde'),hasta=p.hasta===undefined?hoy:valor('hasta'),errores:string[]=[];
 try{fechaRobo(desde,hoy);}catch{errores.push('Indica una fecha de inicio válida, entre 1900 y hoy.');}
 try{fechaRobo(hasta,hoy);}catch{errores.push('Indica una fecha de término válida, entre 1900 y hoy.');}
 if(!errores.length&&desde>hasta)errores.push('La fecha de inicio debe ser anterior o igual a la de término.');
 const filtros:FiltrosRobos={ambito:local?'eeji':['nc','eeji'].includes(valor('ambito'))?valor('ambito'):'',sede:esIdSede(valor('sede'))?valor('sede'):'',comuna:valor('comuna',100),estado:Object.hasOwn(ESTADOS_ROBO,valor('estado'))?valor('estado'):'',desde,hasta,q:valor('q'),pagina:1};
 return {filtros,errores};
}
export function parametrosDashboard(f:FiltrosRobos){
 const p=new URLSearchParams();for(const[k,v]of Object.entries(f))if(v&&k!=='pagina')p.set(k,String(v));return p.toString();
}
export function periodosDashboard(f:Pick<FiltrosRobos,'desde'|'hasta'>){
 const [ai,mi]=f.desde.split('-').map(Number),[af,mf]=f.hasta.split('-').map(Number),meses=(af-ai)*12+mf-mi+1;
 const unidad=meses<=24?'month' as const:'year' as const,periodos:{periodo:string;etiqueta:string}[]=[];
 if(!Number.isInteger(meses)||meses<1||ai<1900||af>9999)throw new Error('Período inválido.');
 for(let y=ai,m=mi;y<af||y===af&&m<=mf;){
  const periodo=unidad==='month'?`${y}-${String(m).padStart(2,'0')}`:String(y);
  const etiqueta=unidad==='month'?new Intl.DateTimeFormat('es-CL',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1))):String(y);
  periodos.push({periodo,etiqueta});if(unidad==='year'){y++;m=1;}else if(m===12){y++;m=1;}else m++;
 }
 return {unidad,periodos};
}
export function celdaCsv(valor:unknown):string{
 const texto=valor===null||valor===undefined?'':String(valor),seguro=/^\s*[=+@-]/u.test(texto)||/^[\t\r]/.test(texto)?"'"+texto:texto;
 return '"'+seguro.replaceAll('"','""')+'"';
}
export function csvDashboardRobos(datos:DatosDashboardRobos,f:FiltrosRobos){
 const cabecera=['Establecimiento / sede','RBD','Comunas de los incidentes','Equipos distintos','Incidentes','Robo validado sin recuperar','Pendiente de validación','Con recuperación','Con reporte rechazado','Incidente desde','Incidente hasta','Estado filtrado','Consulta UTC'];
 const fila=(g:ConteosRobos,nombre:string,rbd:string|null='',comunas:string|null='')=>[nombre,rbd,comunas,g.equipos,g.incidentes,g.robados,g.reportados,g.recuperados,g.rechazados,f.desde,f.hasta,ESTADOS_ROBO[f.estado as keyof typeof ESTADOS_ROBO]??'Todos',datos.consultado];
 const filas=[cabecera,...datos.sedes.map(g=>fila(g,g.nombre,g.rbd,g.comunas)),fila(datos.resumen,'TOTAL GLOBAL · equipos distintos')];
 return '\uFEFF'+filas.map(f=>f.map(celdaCsv).join(';')).join('\r\n')+'\r\n';
}
