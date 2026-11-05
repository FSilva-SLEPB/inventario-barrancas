import EnlaceAccion from '@/components/enlace-accion';
import type {ReactNode} from 'react';
/** Acciones de una fila. La página decide las operaciones permitidas por el servidor. */
export default function AccionesRegistro({nombre,id,verHref,editarHref,verTexto='Ver',children}:{nombre:string;id?:string;verHref?:string;editarHref?:string;verTexto?:string;children?:ReactNode}){
 return <div className="acciones-registro" role="group" aria-label={'Acciones de '+nombre}>
  {verHref&&<EnlaceAccion id={id} href={verHref} etiqueta={verTexto+': '+nombre} icono={verTexto.startsWith('Completar')?'acta':'ver'}/>}
  {editarHref&&<EnlaceAccion href={editarHref} etiqueta={'Editar: '+nombre} icono="editar"/>}
  {children}
 </div>;
}
