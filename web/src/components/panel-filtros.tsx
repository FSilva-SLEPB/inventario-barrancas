'use client';
import Link from 'next/link';
import {useTransition,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
export type BusquedaFiltro={valor:string;placeholder:string;max?:number;id?:string};
export default function PanelFiltros({ruta,titulo='Filtrar registros',children,busqueda,ocultos={},limpiarHref,ayuda,etiqueta='Filtrar registros'}:{ruta:string;titulo?:string;children?:ReactNode;busqueda:BusquedaFiltro;ocultos?:Record<string,string|number>;limpiarHref?:string;ayuda?:string;etiqueta?:string}){
 const router=useRouter(),[pendiente,iniciar]=useTransition(),id=busqueda.id??'buscar-registro';
 const navegar=(form:HTMLFormElement,cambiarTipo=false)=>{
  const p=new URLSearchParams();new FormData(form).forEach((v,k)=>{if(typeof v==='string')p.set(k,v);});p.delete('pagina');
  if(cambiarTipo){p.delete('sede');p.delete('rbd');}
  iniciar(()=>router.push(ruta+(p.size?'?'+p:''),{scroll:false}));
 };
 return <form action={ruta} method="get" className="filtros-inventario filtros-compartidos" aria-label={etiqueta} aria-busy={pendiente} onSubmit={e=>{e.preventDefault();navegar(e.currentTarget);}} onChange={e=>{const c=e.target;if(c instanceof HTMLSelectElement&&c.dataset.actualizarFiltro==='si')navegar(e.currentTarget,c.name==='tipo');}}>
 <div className="titulo-filtros">{titulo}</div>{Object.entries(ocultos).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
 <fieldset disabled={pendiente}><legend className="visually-hidden">{titulo}</legend>{children}<div className="filtro-inventario-busqueda"><label htmlFor={id}>Búsqueda general</label><input id={id} name="q" type="search" maxLength={busqueda.max??150} defaultValue={busqueda.valor} placeholder={busqueda.placeholder}/></div><div className="filtro-inventario-acciones"><button className="btn btn-primary" type="submit">Buscar</button><Link className="btn btn-outline-primary" href={limpiarHref??(ocultos.limite?`${ruta}?limite=${ocultos.limite}`:ruta)}>Limpiar</Link></div></fieldset>
 {ayuda&&<p className="ayuda-tipo" id="ayuda-tipo">{ayuda}</p>}<span className="visually-hidden" role="status">{pendiente?'Actualizando resultados…':''}</span></form>;
}
export function RegistrosPorPagina({ruta,limite,filtros}:{ruta:string;limite:number;filtros:Record<string,string>}){
 return <form action={ruta} method="get" className="registros-por-pagina">{Object.entries(filtros).filter(([k])=>!['pagina','ver','editar','nuevo','aviso','limite'].includes(k)).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}<label htmlFor="registros-por-pagina">Mostrar</label><select id="registros-por-pagina" name="limite" aria-label="Registros por página" defaultValue={String(limite)} onChange={e=>e.currentTarget.form?.requestSubmit()}>{[50,100,150].map(n=><option key={n}>{n}</option>)}</select><span>registros</span></form>;
}
