import type {ReactNode} from 'react';
import ModalFicha from '@/components/modal-ficha';
export default function VentanaEdicion({activa,titulo,cerrarHref,children}:{activa:boolean;titulo:string;cerrarHref:string;children:ReactNode}){
 return activa?<ModalFicha titulo={titulo} cerrarHref={cerrarHref} editando>{children}</ModalFicha>:<>{children}</>;
}
