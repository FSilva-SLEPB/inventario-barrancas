import Link from 'next/link';
import type {ReactNode} from 'react';
/** Acciones de una fila. La página decide las operaciones permitidas por el servidor. */
export default function AccionesRegistro({nombre,id,verHref,editarHref,verTexto='Ver',children}:{nombre:string;id?:string;verHref?:string;editarHref?:string;verTexto?:string;children?:ReactNode}){
 return <div className="acciones-registro" role="group" aria-label={'Acciones de '+nombre}>
  {verHref&&<Link className="btn btn-outline-primary btn-sm" data-ficha-id={id} scroll={false} href={verHref} aria-label={verTexto+': '+nombre}>{verTexto}</Link>}
  {editarHref&&<Link className="btn btn-outline-primary btn-sm" scroll={false} href={editarHref} aria-label={'Editar: '+nombre}>Editar</Link>}
  {children}
 </div>;
}
