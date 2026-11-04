'use client';
import Link from 'next/link';
import BotonImprimirActa from '@/components/actas/boton-imprimir-acta';
// Las cuatro familias de actas reutilizan estas acciones sobre el PDF conservado.
export default function AccionesDocumento({id,correoHref}:{id:string;correoHref:string}){
 const pdf='/inventario/actas/'+id+'/pdf';
 return <><div className="acciones-catalogos acciones-documento"><BotonImprimirActa id={id}/><Link className="btn btn-outline-primary" href={correoHref} scroll={false}>Enviar por correo</Link><a className="btn btn-outline-primary" href={pdf+'?descargar=si'}>Descargar PDF</a><a href={pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a></div><iframe className="visor-acta-pdf" src={pdf} title="PDF del acta emitida"/></>;
}
