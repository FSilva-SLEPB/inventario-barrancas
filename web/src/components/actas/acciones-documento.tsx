'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
// Las cuatro familias de actas reutilizan estas acciones sobre el PDF conservado.
export default function AccionesDocumento({id,correoHref}:{id:string;correoHref:string}){
 const marco=useRef<HTMLIFrameElement>(null),[listo,setListo]=useState(false),[ayuda,setAyuda]=useState('');const pdf='/inventario/actas/'+id+'/pdf';
 const imprimir=()=>{try{marco.current?.contentWindow?.focus();marco.current?.contentWindow?.print();setAyuda('Si la impresión no se abre, usa «Abrir PDF» y la opción de imprimir de tu navegador.');}catch{setAyuda('Abre el PDF para imprimirlo desde tu navegador.');}};
 return <><div className="acciones-catalogos acciones-documento"><button className="btn btn-primary" disabled={!listo} onClick={imprimir}>Imprimir</button><Link className="btn btn-outline-primary" href={correoHref} scroll={false}>Enviar por correo</Link><a className="btn btn-outline-primary" href={pdf+'?descargar=si'}>Descargar PDF</a><a href={pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a></div><p role="status" className="ayuda-catalogos">{ayuda}</p><iframe ref={marco} className="visor-acta-pdf" src={pdf} title="PDF del acta emitida" onLoad={()=>setListo(true)}/></>;
}
