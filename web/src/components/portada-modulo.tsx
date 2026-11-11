import type {ReactNode} from 'react';
import type {ModuloSistema} from '@/lib/modulos';
import AccesosModulo from '@/components/accesos-modulo';
export default function PortadaModulo({modulo,children}:{modulo:ModuloSistema;children?:ReactNode}){
 return <main className="portada-modulo"><header><h1>{modulo.titulo}</h1><p className="descripcion-pagina">{modulo.descripcion}</p></header><AccesosModulo id={'accesos-'+modulo.id} titulo={'Accesos de '+modulo.titulo.toLocaleLowerCase('es')} accesos={modulo.accesos}/>{children}</main>;
}
