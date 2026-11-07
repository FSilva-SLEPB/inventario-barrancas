'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {validarAvisoExito} from '@/app/avisos/acciones';
export async function mostrarExito(titulo:string,texto:string){
 const {default:Swal}=await import('sweetalert2');
 await Swal.fire({target:document.querySelector<HTMLElement>('dialog[open]')??document.body,icon:'success',title:titulo,text:texto,confirmButtonText:'Aceptar',heightAuto:false,buttonsStyling:false,customClass:{popup:'confirmacion-guardado',confirmButton:'btn btn-primary'},showClass:{popup:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'':'swal2-show'},hideClass:{popup:''}});
}
export function useResultadoGuardado(estado:{estado?:string;resultado?:string;mensaje:string}){
 const visto=useRef<unknown>(null);
 useEffect(()=>{if((estado.estado==='guardado'||estado.resultado==='guardado')&&visto.current!==estado){visto.current=estado;void mostrarExito('Guardado exitoso',estado.mensaje);}},[estado]);
}
export default function AvisosGuardado(){
 const p=useSearchParams(),ruta=usePathname(),ultimo=useRef(''),token=p.get('aviso')??'';
 useEffect(()=>{
  if(!token||ultimo.current===token)return;ultimo.current=token;
  void validarAvisoExito(token,ruta).then(aviso=>{
   const url=new URL(window.location.href);
   if(url.pathname!==ruta||url.searchParams.get('aviso')!==token)return;
   url.searchParams.delete('aviso');window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
   if(!aviso)return;
   const clave='inventario-aviso-'+aviso.id;
   try{if(sessionStorage.getItem(clave))return;sessionStorage.setItem(clave,'1');}catch{/* El aviso también funciona cuando el almacenamiento está deshabilitado. */}
   void mostrarExito(aviso.titulo,aviso.texto);
  }).catch(()=>{/* La confirmación nunca bloquea la navegación ni vuelve a enviar el formulario. */});
 },[token,ruta]);
 return null;
}
