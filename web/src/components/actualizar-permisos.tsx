'use client';
import {useEffect} from 'react';import {useRouter} from 'next/navigation';
export default function ActualizarPermisos({revision}:{revision:string}){
 const router=useRouter();useEffect(()=>{let vivo=true,pendiente=false;const comprobar=async()=>{if(pendiente)return;pendiente=true;try{const r=await fetch('/api/acceso',{cache:'no-store'});if(!vivo)return;if(r.status===401){router.refresh();return;}if(r.ok&&(await r.json()).revision!==revision)router.refresh();}catch{/* El servidor sigue comprobando cada operación. */}finally{pendiente=false;}};const t=setInterval(()=>void comprobar(),60000);const foco=()=>void comprobar();window.addEventListener('focus',foco);return()=>{vivo=false;clearInterval(t);window.removeEventListener('focus',foco);};},[revision,router]);return null;
}
