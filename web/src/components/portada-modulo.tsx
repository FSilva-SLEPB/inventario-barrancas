import Link from 'next/link';
import type {ReactNode} from 'react';
import type {ModuloSistema} from '@/lib/modulos';
export default function PortadaModulo({modulo,children}:{modulo:ModuloSistema;children?:ReactNode}){
 return <main className="portada-modulo"><header><p className="etiqueta-ficha">Gestión institucional</p><h1>{modulo.titulo}</h1><p className="descripcion-pagina">{modulo.descripcion}</p></header>
 {modulo.accesos.length>0&&<section aria-labelledby={'accesos-'+modulo.id}><h2 id={'accesos-'+modulo.id}>Accesos de {modulo.titulo.toLocaleLowerCase('es')}</h2><div className="accesos-modulo">{modulo.accesos.map(a=><Link className="acceso-modulo" href={a.href} key={a.href}><span className="acceso-modulo-icono" aria-hidden="true">{a.icono}</span><h3>{a.titulo}</h3><p>{a.descripcion}</p><strong>Entrar <span aria-hidden="true">→</span></strong></Link>)}</div></section>}{children}</main>;
}
