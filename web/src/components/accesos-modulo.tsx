import Link from 'next/link';
import type {AccesoModulo} from '@/lib/modulos';
/** Una misma tarjeta de navegación en Inicio y en las portadas de módulos. */
export default function AccesosModulo({id,titulo,accesos}:{id:string;titulo:string;accesos:AccesoModulo[]}){
 if(!accesos.length)return null;
 return <section aria-labelledby={id}><h2 id={id}>{titulo}</h2><div className="accesos-modulo">{accesos.map(a=>{
  const Enlace=a.externo?'a':Link;
  return <Enlace className="acceso-modulo" href={a.href} key={a.href} target={a.externo?'_blank':undefined} rel={a.externo?'noopener noreferrer':undefined}><span className="acceso-modulo-icono" aria-hidden="true">{a.icono}</span><h3>{a.titulo}</h3><p>{a.descripcion}</p><strong>{a.externo?'Abrir':'Entrar'} <span aria-hidden="true">→</span></strong>{a.externo&&<span className="visually-hidden">Se abre en otra pestaña</span>}</Enlace>;
 })}</div></section>;
}
