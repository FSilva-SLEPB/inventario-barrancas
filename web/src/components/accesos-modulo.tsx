import Link from 'next/link';
import type {AccesoModulo} from '@/lib/modulos';
/** Una misma tarjeta de navegación en Inicio y en las portadas de módulos. */
export default function AccesosModulo({id,titulo,accesos}:{id:string;titulo:string;accesos:AccesoModulo[]}){
 if(!accesos.length)return null;
 return <section aria-labelledby={id}><h2 id={id}>{titulo}</h2><div className="accesos-modulo">{accesos.map(a=><Link className="acceso-modulo" href={a.href} key={a.href}><span className="acceso-modulo-icono" aria-hidden="true">{a.icono}</span><h3>{a.titulo}</h3><p>{a.descripcion}</p><strong>Entrar <span aria-hidden="true">→</span></strong></Link>)}</div></section>;
}
