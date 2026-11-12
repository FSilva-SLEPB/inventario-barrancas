'use client';
import {useRef,useState} from 'react';
import IconoAccion from '@/components/icono-accion';
export default function BotonImprimirActa({id,nombre='acta'}:{id:string;nombre?:string}){
 const marco=useRef<HTMLIFrameElement>(null),boton=useRef<HTMLButtonElement>(null),[solicitado,setSolicitado]=useState(false),[cargando,setCargando]=useState(false),[mensaje,setMensaje]=useState('');
 const imprimir=()=>{try{if(!marco.current?.contentWindow)throw new Error();marco.current.contentWindow.focus();marco.current.contentWindow.print();setMensaje('Si no se abre la impresión, usa Abrir PDF.');}catch{setMensaje('Abre el PDF para imprimirlo desde tu navegador.');}finally{requestAnimationFrame(()=>boton.current?.focus());}};
 return <span className="accion-imprimir"><button ref={boton} type="button" className="btn btn-outline-primary btn-sm accion-icono" title={cargando?'Preparando impresión…':'Imprimir: '+nombre} aria-label={'Imprimir: '+nombre} disabled={cargando} onClick={()=>{if(solicitado)imprimir();else{setCargando(true);setSolicitado(true);}}}><IconoAccion tipo="imprimir"/><span className="visually-hidden">{cargando?'Preparando…':'Imprimir'}</span></button>{solicitado&&<><iframe ref={marco} className="marco-impresion-acta" title={'Impresión de '+nombre} src={'/inventario/actas/'+id+'/pdf?imprimir=si'} onLoad={()=>{setCargando(false);imprimir();}}/><a className="alternativa-impresion" href={'/inventario/actas/'+id+'/pdf?imprimir=si'} target="_blank" rel="noopener noreferrer">Abrir PDF</a><span className="visually-hidden" role="status">{mensaje}</span></>}</span>;
}
