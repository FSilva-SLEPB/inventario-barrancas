import {esIdSede} from '@/lib/validacion-sedes';
export type VistaInformeInsumos='dashboard'|'sedes'|'productos'|'consolidado'|'detalle'|'stock';
export type GrupoInsumos='todas'|'pendientes'|'validadas'|'aprobadas'|'entregadas';
export type FiltroGestor={sede:string;producto:string;desde:string;hasta:string;tipo:string;categoria:string;q:string;estado:string;base:'solicitud'|'entrega';grupo:GrupoInsumos;vista:VistaInformeInsumos;pagina:number;limite:number};
export const VISTAS_INFORME:Record<VistaInformeInsumos,string>={dashboard:'Resumen',sedes:'Solicitudes por establecimiento',productos:'Solicitado y entregado por producto',consolidado:'Entregado por establecimiento y producto',detalle:'Detalle de solicitudes y entregas',stock:'Stock actual de bodega'};
export const CLAVES_FILTRO=['sede','producto','desde','hasta','tipo','categoria','q','estado','base','grupo','vista','pagina','limite'];
export function leerFiltroGestor(p:Record<string,string|string[]|undefined>,forzar:Partial<FiltroGestor>={}):FiltroGestor{
 const v=(k:string,max=150)=>{const r=p[k];if(Array.isArray(r)||r!==undefined&&r.length>max)throw new Error('Filtros inválidos o repetidos.');return r?.trim()??'';};
 const f:FiltroGestor={sede:v('sede',36),producto:v('producto',36),desde:v('desde',10),hasta:v('hasta',10),tipo:v('tipo',30),categoria:v('categoria',120),q:v('q'),estado:v('estado',30),base:(v('base',20)||'solicitud')as FiltroGestor['base'],grupo:(v('grupo',20)||'todas')as GrupoInsumos,vista:(v('vista',20)||'dashboard')as VistaInformeInsumos,pagina:Number(v('pagina',6)||1),limite:Number(v('limite',5)||50),...forzar};
 if(f.sede&&!esIdSede(f.sede)||f.producto&&!esIdSede(f.producto)||!['','establecimiento','jardin_infantil','nivel_central'].includes(f.tipo)||!['','activas','finalizadas','solicitada','en_validacion','aprobada','entregada','cancelada'].includes(f.estado)||!['solicitud','entrega'].includes(f.base)||!['todas','pendientes','validadas','aprobadas','entregadas'].includes(f.grupo)||!Object.hasOwn(VISTAS_INFORME,f.vista)||!Number.isInteger(f.pagina)||f.pagina<1||f.pagina>999999||![50,100,150,10000].includes(f.limite))throw new Error('Filtros fuera de rango.');
 for(const fecha of [f.desde,f.hasta])if(fecha&&(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!Number.isFinite(Date.parse(fecha))||new Date(fecha).toISOString().slice(0,10)!==fecha))throw new Error('Fecha inválida.');
 if(f.desde&&f.hasta&&f.desde>f.hasta)throw new Error('La fecha inicial debe ser anterior a la final.');
 return f;
}
export function parametrosGestor(f:FiltroGestor){return Object.fromEntries(Object.entries(f).map(([k,v])=>[k,String(v)]));}
export function enlaceInformeInsumos(f:FiltroGestor,vista:VistaInformeInsumos,formato='csv'){return '/gestor-insumos/exportar?'+new URLSearchParams({...parametrosGestor(f),vista,formato,pagina:'1'});}
