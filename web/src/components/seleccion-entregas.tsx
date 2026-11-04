"use client";
import { useEffect, useRef, useState } from "react";
const selector='input[form="seleccion-entregas"][type="checkbox"]:not(:disabled)';

export function SeleccionarTodos({ pagina }: {pagina:string}) {
  const control=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const actualizar=()=>{
      const filas=[...document.querySelectorAll<HTMLInputElement>(selector)],marcadas=filas.filter(e=>e.checked).length;
      if(control.current){control.current.checked=filas.length>0&&marcadas===filas.length;control.current.indeterminate=marcadas>0&&marcadas<filas.length;control.current.disabled=filas.length===0;}
    };
    actualizar();document.addEventListener('change',actualizar);document.addEventListener('seleccion-entregas',actualizar);
    return()=>{document.removeEventListener('change',actualizar);document.removeEventListener('seleccion-entregas',actualizar);};
  },[pagina]);
  return <label className="seleccionar-todos"><input ref={control} type="checkbox" aria-label="Seleccionar todos los equipos de jardines de esta página" onChange={e=>{
    document.querySelectorAll<HTMLInputElement>(selector).forEach(f=>{f.checked=e.currentTarget.checked;});document.dispatchEvent(new Event('seleccion-entregas'));
  }}/><span>Seleccionar</span></label>;
}
export default function SeleccionEntregas({ pagina }: {pagina:string}) {
  const [cantidad,setCantidad]=useState(0);
  useEffect(()=>{
    const actualizar=()=>setCantidad([...document.querySelectorAll<HTMLInputElement>(selector)].filter(e=>e.checked).length);
    actualizar();document.addEventListener('change',actualizar);document.addEventListener('seleccion-entregas',actualizar);
    return()=>{document.removeEventListener('change',actualizar);document.removeEventListener('seleccion-entregas',actualizar);};
  },[pagina]);
  return <form id="seleccion-entregas" action="/inventario/movimientos/regularizar" method="get" className="seleccion-entregas-compacta">
    <span role="status">{cantidad?`${cantidad} seleccionados`:'Selecciona entregas anteriores'}</span>
    <button type="submit" className="btn btn-primary" disabled={!cantidad}>Registrar entrega anterior</button>
  </form>;
}
