"use client";
import {useResultadoGuardado} from '@/components/avisos-guardado';
import { useActionState, useState } from "react";
import { guardarEquipo } from "@/app/inventario/acciones";
import { CAMPOS_COMPRA,CONDICIONES,ORIGENES,valoresEquipo,type ValoresEquipo,type EstadoEquipo } from "@/lib/validacion-equipos";
import type { Sede } from "@/lib/validacion-sedes";
import type { CategoriaBien } from "@/lib/catalogos";
import { etiquetaSede } from "@/lib/etiqueta-sede";
export default function FormularioEquipo({inicial,sedes,categorias,local=false}:{
  inicial?:ValoresEquipo;sedes:Sede[];categorias:CategoriaBien[];local?:boolean;
}) {
  const valores=inicial??{...valoresEquipo(),origen:local?"compra_sede":"compra_utic",sedeId:local?sedes[0]?.id??"":""};
  const base:EstadoEquipo={resultado:"inicial",mensaje:"",valores,errores:{},revision:"inicial"};
  const [estado,accion,pendiente]=useActionState(guardarEquipo,base);
 useResultadoGuardado(estado);
  const v=estado.valores;
  const [identificacion,setIdentificacion]=useState({serie:valores.serie,inventario:valores.inventario});
  const campo=(nombre:keyof ValoresEquipo,etiqueta:string,obligatorio=false,maxLength=120)=><div className="campo-catalogos" key={nombre}>
    <label htmlFor={`equipo-${nombre}`}>{etiqueta}{obligatorio?" (obligatorio)":""}</label>
    <input id={`equipo-${nombre}`} name={nombre} required={obligatorio} maxLength={maxLength}
      defaultValue={v[nombre]} onChange={e=>{if(nombre==="serie"||nombre==="inventario"){const valor=e.currentTarget.value;setIdentificacion(v=>({...v,[nombre]:valor}));}}} aria-invalid={Boolean(estado.errores[nombre])} aria-describedby={`error-${nombre}`} />
    <p id={`error-${nombre}`} className="error-catalogos">{estado.errores[nombre]}</p>
  </div>;
  return <form action={accion} aria-busy={pendiente} className="formulario-catalogos formulario-equipo">
    <input type="hidden" name="id" value={v.id}/><input type="hidden" name="version" value={v.version}/>
    <fieldset key={estado.revision} disabled={pendiente} className="border-0 p-0 m-0">
      <legend>Datos del equipo</legend>
      <div className="campo-catalogos"><label htmlFor="equipo-sedeId">Sede de destino (obligatoria)</label>
        {v.id ? <><input type="hidden" name="sedeId" value={v.sedeId}/><p>{sedes.find(s=>s.id===v.sedeId)?etiquetaSede(sedes.find(s=>s.id===v.sedeId)!):"Sede no disponible"}</p></>
          : <select id="equipo-sedeId" name="sedeId" required defaultValue={v.sedeId}>
            <option value="">Selecciona una sede</option>{sedes.filter(s=>s.activo).map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select>}
        <p className="error-catalogos">{estado.errores.sedeId}</p>
      </div>
      <div className="campo-catalogos"><label htmlFor="equipo-categoriaId">Categoría (obligatoria)</label>
        <select id="equipo-categoriaId" name="categoriaId" required defaultValue={v.categoriaId}>
          <option value="">Selecciona una categoría</option>{categorias.filter(c=>c.activo||c.id===v.categoriaId).map(c=><option key={c.id} value={c.id}>{c.nombre}{!c.activo?" (inactiva)":""}</option>)}</select>
        <p className="error-catalogos">{estado.errores.categoriaId}</p></div>
      {campo("marca","Marca",true)}{campo("modelo","Modelo",true,200)}
      {campo("serie","Número de serie")}{campo("inventario","Número de inventario")}
      {!identificacion.serie.trim()||!identificacion.inventario.trim()?campo("motivoIdentificacion","¿Por qué falta la serie o el número de inventario?",true,500):<input type="hidden" name="motivoIdentificacion" value={v.motivoIdentificacion}/>}
      <div className="campo-catalogos"><label htmlFor="equipo-origen">Origen</label>
        {v.id ? <><input type="hidden" name="origen" value={v.origen}/><p>{ORIGENES[v.origen as keyof typeof ORIGENES]}</p></>
          : <select id="equipo-origen" name="origen" defaultValue={v.origen}>{Object.entries(ORIGENES).filter(([k])=>!local||k!=="compra_utic").map(([k,label])=><option key={k} value={k}>{label}</option>)}</select>}
        <p className="error-catalogos">{estado.errores.origen}</p></div>
      <div className="campo-catalogos"><label htmlFor="equipo-condicionTecnica">Estado de funcionamiento</label>
        <select id="equipo-condicionTecnica" name="condicionTecnica" defaultValue={v.condicionTecnica}>
          {Object.entries(CONDICIONES).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select><p className="ayuda-catalogos">Indica si funciona o requiere reparación. No cambia su entrega, asignación ni situación por robo.</p></div>
      <details><summary>Datos de adquisición disponibles</summary>
        {Object.entries(CAMPOS_COMPRA).map(([k,label])=>campo(k as keyof ValoresEquipo,label,false,250))}</details>
      <div className="campo-catalogos"><label htmlFor="equipo-observaciones">Observaciones</label>
        <textarea id="equipo-observaciones" name="observaciones" maxLength={2000} defaultValue={v.observaciones}/>
        <p className="error-catalogos">{estado.errores.observaciones}</p></div>
      {v.id ? campo("motivoCambio","Descripción breve del cambio",true,500):<input type="hidden" name="motivoCambio" value=""/>}
      {!v.id&&<p>Los ingresos propios de la sede se incorporan de inmediato. Una compra de UTIC destinada a EE/JI queda pendiente de entrega.</p>}
      <button type="submit" className="boton-catalogos" disabled={pendiente}>{pendiente?"Guardando…":v.id?"Guardar cambios":"Registrar equipo"}</button>
    </fieldset>
    <p role={estado.resultado==="error"?"alert":"status"}>{estado.mensaje}</p>
  </form>;
}
