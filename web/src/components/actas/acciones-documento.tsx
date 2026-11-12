'use client';
import Link from 'next/link';
import BotonImprimirActa from '@/components/actas/boton-imprimir-acta';
// Las cuatro familias de actas reutilizan estas acciones sobre el PDF conservado.
export default function AccionesDocumento({id,correoHref,enviar=true,imprimir=true,descargar=true}:{id:string;correoHref:string;enviar?:boolean;imprimir?:boolean;descargar?:boolean}){
 const pdf='/inventario/actas/'+id+'/pdf';
 return <><div className="acciones-catalogos acciones-documento">{imprimir&&<BotonImprimirActa id={id}/>}{enviar&&<Link className="btn btn-outline-primary" href={correoHref} scroll={false}>Enviar por correo</Link>}{descargar&&<a className="btn btn-outline-primary" href={pdf+'?descargar=si'}>Descargar PDF</a>}<a href={pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a></div><iframe className="visor-acta-pdf" src={pdf} title="PDF del acta emitida"/></>;
}
