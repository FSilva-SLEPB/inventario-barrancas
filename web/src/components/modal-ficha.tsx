'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
export default function ModalFicha({children,titulo,cerrarHref,editando=false,focoId,alCerrar}:{children:ReactNode;titulo:string;cerrarHref?:string;editando?:boolean;focoId?:string;alCerrar?:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),id=useId(),router=useRouter();
 const cerrar=()=>{if(!ref.current?.querySelector('form[aria-busy="true"]')){if(alCerrar)alCerrar();else if(cerrarHref)router.replace(cerrarHref,{scroll:false});}};
 useEffect(()=>{
  const dialogo=ref.current;if(!dialogo)return;
  const previo=document.activeElement instanceof HTMLElement?document.activeElement:null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';dialogo.showModal();
  const campo=editando?dialogo.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea'):dialogo.querySelector<HTMLElement>('[data-editar-ficha]');
  (campo??dialogo.querySelector<HTMLElement>('h2'))?.focus();
  return()=>{dialogo.close();document.body.style.overflow=overflow;requestAnimationFrame(()=>{if(document.querySelector('dialog[open]'))return;const origen=focoId?document.querySelector<HTMLElement>(`[data-ficha-id="${focoId}"]`):null;const destino=origen??(previo?.isConnected&&previo!==document.body?previo:null)??document.querySelector<HTMLElement>('main h1');if(destino){if(!destino.hasAttribute('tabindex')&&destino.tagName==='H1')destino.tabIndex=-1;destino.focus({preventScroll:true});}});};
 },[editando,focoId]);
 return <dialog ref={ref} className="modal-ficha" aria-labelledby={id} onKeyDown={e=>{
  if(e.key!=='Tab')return;
  const campos=[...e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(n=>n.getClientRects().length>0);
  const primero=campos[0],ultimo=campos.at(-1);
  if(!primero){e.preventDefault();return;}
  if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus();}
  else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero.focus();}
 }} onCancel={e=>{e.preventDefault();cerrar();}}><div className="modal-ficha-cabecera"><h2 id={id} tabIndex={-1}>{titulo}</h2><button type="button" className="btn btn-outline-secondary" aria-label="Cerrar ventana" onClick={cerrar}>Cerrar <span aria-hidden="true">×</span></button></div><div className="modal-ficha-contenido">{children}</div></dialog>;
}
