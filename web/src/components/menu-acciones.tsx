import {Children,type ReactNode} from 'react';
/** Desplegable nativo en el flujo, sin tapar columnas ni depender del ratón. */
export default function MenuAcciones({titulo,children}:{titulo:string;children:ReactNode}){
 if(!Children.toArray(children).length)return null;
 return <details className="menu-acciones"><summary className="btn btn-outline-primary btn-sm">{titulo} <span aria-hidden="true">▾</span></summary><div className="menu-acciones-contenido">{children}</div></details>;
}
