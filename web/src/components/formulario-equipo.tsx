"use client";
import CampoCondicionActivo from '@/components/campo-condicion-activo';
import CampoCustodiaInicial from '@/components/campo-custodia-inicial';
import {useResultadoGuardado} from '@/components/avisos-guardado';
import { useActionState, useState } from "react";
import { guardarEquipo } from "@/app/inventario/acciones";
import { CAMPOS_COMPRA,valoresEquipo,type ValoresEquipo,type EstadoEquipo } from "@/lib/validacion-equipos";
import type { Sede } from "@/lib/validacion-sedes";
import type { CategoriaBien } from "@/lib/catalogos";
import { etiquetaSede } from "@/lib/etiqueta-sede";
export default function FormularioEquipo({inicial,sedes,categorias,local=false,volver,estadoAdministrativo='activo'}:{
  inicial?:ValoresEquipo;sedes:Sede[];categorias:CategoriaBien[];local?:boolean;volver?:string;estadoAdministrativo?:string;
}) {
  const valores=inicial??{...valoresEquipo(),origen:"otro",sedeId:local?sedes[0]?.id??"":""};
  const base:EstadoEquipo={resultado:"inicial",mensaje:"",valores,errores:{},revision:"inicial"};
  const [estado,accion,pendiente]=useActionState(guardarEquipo,base);
 useResultadoGuardado(estado);
  const v=estado.valores;
  const [identificacion,setIdentificacion]=useState({serie:valores.serie,inventario:valores.inventario});
  const campo=(nombre:keyof ValoresEquipo,etiqueta:string,obligatorio=false,maxLength=120)=><div className="campo-catalogos" key={nombre}>
    <label htmlFor={`equipo-${nombre}`}>{etiqueta}{obligatorio?" *":""}</label>
    <input id={`equipo-${nombre}`} name={nombre} required={obligatorio} maxLength={maxLength}
      defaultValue={v[nombre]} onChange={e=>{if(nombre==="serie"||nombre==="inventario"){const valor=e.currentTarget.value;setIdentificacion(v=>({...v,[nombre]:valor}));}}} aria-invalid={Boolean(estado.errores[nombre])} aria-describedby={`error-${nombre}`} />
    <p id={`error-${nombre}`} className="error-catalogos">{estado.errores[nombre]}</p>
  </div>;
  return <form action={accion} aria-busy={pendiente} className="formulario-catalogos formulario-equipo">
    {volver&&<input type="hidden" name="volver" value={volver}/>}
    <input type="hidden" name="id" value={v.id}/><input type="hidden" name="version" value={v.version}/>
    <fieldset key={estado.revision} disabled={pendiente} className="border-0 p-0 m-0">
      <legend>Datos del equipo</legend>{!v.id&&<CampoCustodiaInicial local={local} valor={estado.custodiaInicial}/>}
      <div className="campo-catalogos"><label htmlFor="equipo-sedeId">Sede de destino *</label>
        {v.id ? <><input type="hidden" name="sedeId" value={v.sedeId}/><p>{sedes.find(s=>s.id===v.sedeId)?etiquetaSede(sedes.find(s=>s.id===v.sedeId)!):"Sede no disponible"}</p></>
          : <select id="equipo-sedeId" name="sedeId" required defaultValue={v.sedeId}>
            <option value="">Selecciona una sede</option>{sedes.filter(s=>s.activo).map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select>}
        <p className="error-catalogos">{estado.errores.sedeId}</p>
      </div>
      <div className="campo-catalogos"><label htmlFor="equipo-categoriaId">Categoría *</label>
        <select id="equipo-categoriaId" name="categoriaId" required defaultValue={v.categoriaId}>
          <option value="">Selecciona una categoría</option>{categorias.filter(c=>c.activo||c.id===v.categoriaId).map(c=><option key={c.id} value={c.id}>{c.nombre}{!c.activo?" (inactiva)":""}</option>)}</select>
        <p className="error-catalogos">{estado.errores.categoriaId}</p></div>
      {campo("marca","Marca",true)}{campo("modelo","Modelo",true,200)}
      {campo("serie","Número de serie")}{campo("inventario","Número de inventario (opcional)")}
      <input type="hidden" name="motivoIdentificacion" value={v.motivoIdentificacion}/>
      <input type="hidden" name="origen" value={v.origen}/>
      <CampoCondicionActivo existente={Boolean(v.id)} id="equipo-condicionTecnica" valor={v.condicionTecnica} administrativo={estadoAdministrativo}/>
      {Object.keys(CAMPOS_COMPRA).map(k=><input key={k} type="hidden" name={k} value={v[k as keyof ValoresEquipo]}/>)}
      <div className="campo-catalogos"><label htmlFor="equipo-observaciones">Observaciones{!identificacion.serie.trim()?" *":""}</label>
        <textarea id="equipo-observaciones" name="observaciones" required={!identificacion.serie.trim()} maxLength={2000} defaultValue={v.observaciones}/>
        <p className="error-catalogos">{estado.errores.observaciones}</p></div>
      {v.id ? campo("motivoCambio","Descripción breve del cambio",true,500):<input type="hidden" name="motivoCambio" value=""/>}
      <p className="ayuda-catalogos">Si no informas el número de serie, explica el motivo en Observaciones. El número de inventario puede incorporarse después.</p><p>* Estos datos son obligatorios.</p>
      <button type="submit" className="boton-catalogos" disabled={pendiente}>{pendiente?"Guardando…":v.id?"Guardar cambios":"Registrar equipo"}</button>
    </fieldset>
    <p role={estado.resultado==="error"?"alert":"status"}>{estado.mensaje}</p>
  </form>;
}
