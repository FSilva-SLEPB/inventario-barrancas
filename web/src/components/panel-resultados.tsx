import Link from 'next/link';
import type {ReactNode} from 'react';
import {RegistrosPorPagina} from '@/components/panel-filtros';
export default function PanelResultados({total,descripcion,ruta,limite,filtros,pagina,paginas,acciones,children}:{total:number;descripcion:string;ruta:string;limite:number;filtros:Record<string,string>;pagina:number;paginas:number;acciones?:ReactNode;children:ReactNode}){
 const href=(n:number)=>ruta+'?'+new URLSearchParams({...Object.fromEntries(Object.entries(filtros).filter(([k])=>!['ver','editar','nuevo','aviso'].includes(k))),limite:String(limite),pagina:String(n)});
 return <section className="resultados-inventario" aria-label="Resultados de la consulta"><div className="resumen-resultados"><p><strong>{total.toLocaleString('es-CL')}</strong> {descripcion}</p><div className="acciones-resumen">{acciones}<RegistrosPorPagina ruta={ruta} limite={limite} filtros={filtros}/></div></div>{children}<nav className="paginacion-resultados" aria-label="Páginas de resultados"><span>Página {pagina} de {paginas} · {total?`${(pagina-1)*limite+1}–${Math.min(pagina*limite,total)} de ${total.toLocaleString('es-CL')}`:'Sin resultados'}</span><div>{pagina>1&&<Link href={href(pagina-1)}>Anterior</Link>}{pagina<paginas&&<Link href={href(pagina+1)}>Siguiente</Link>}</div></nav></section>;
}
