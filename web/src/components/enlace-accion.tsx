import Link from 'next/link';
import IconoAccion,{type TipoIcono} from '@/components/icono-accion';
export default function EnlaceAccion({href,etiqueta,icono,id}:{href:string;etiqueta:string;icono:TipoIcono;id?:string}){
 return <Link href={href} scroll={false} data-ficha-id={id} className="btn btn-outline-primary btn-sm accion-icono" aria-label={etiqueta} title={etiqueta}><IconoAccion tipo={icono}/><span className="visually-hidden">{etiqueta}</span></Link>;
}
