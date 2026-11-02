"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { regularizarEntregas, type EstadoRegularizacion } from "@/app/inventario/movimientos/regularizar/acciones";
import { fechaSugeridaEntrega, type BaseEntrega } from "@/lib/validacion-entregas";
import type { EquipoEntrega } from "@/lib/entregas";

export default function FormularioRegularizacion({ equipos, solicitud, hoy }: { equipos: EquipoEntrega[]; solicitud: string; hoy: string }) {
  const [estado,accion,pendiente]=useActionState(regularizarEntregas,{estado:'inicial',mensaje:'',valores:{}} as EstadoRegularizacion);
  const [editados,setEditados]=useState<Record<string,string>>({});
  const grupos=Object.values(equipos.reduce<Record<string,{sedeId:string;nombre:string;rbd:string|null;comuna:string|null;directora:string|null;rut:string|null;correo:string|null;direccion:string|null;correoInstitucional:string|null;sedeVersion:string;equipos:EquipoEntrega[]}>>((a,e)=>{
    a[e.sedeId]??={sedeId:e.sedeId,nombre:e.sedeNombre,rbd:e.rbd,comuna:e.comuna,directora:e.directoraNombre,rut:e.directoraRut??null,correo:e.directoraCorreo??null,direccion:e.direccion??null,correoInstitucional:e.correoInstitucional??null,sedeVersion:e.sedeVersion,equipos:[]};a[e.sedeId].equipos.push(e);return a;
  },{}));
  const seleccion:BaseEntrega[]=grupos.map(g=>({sedeId:g.sedeId,equipos:g.equipos.map(e=>({id:e.id,version:e.version}))}));
  const faltantes=grupos.filter(g=>!g.directora);
  return <form action={accion} aria-busy={pendiente} className="regularizacion-formulario">
    <input type="hidden" name="solicitud" value={solicitud}/><input type="hidden" name="seleccion" value={JSON.stringify(seleccion)}/>
    <p><strong>{equipos.length} {equipos.length===1?'equipo':'equipos'} · {grupos.length} {grupos.length===1?'jardín':'jardines'}.</strong> La directora se obtiene del directorio y la fecha de las entregas de octubre de 2026 por comuna.</p>
    {faltantes.length>0&&<p role="alert" className="error-catalogos">Falta incorporar al directorio la responsable de {faltantes.length} jardines. <Link href="/mantenedores/directores">Completar directorio</Link> antes de confirmar.</p>}
    <fieldset disabled={pendiente} className="border-0 p-0 m-0"><legend className="visually-hidden">Entregas seleccionadas</legend>
      {grupos.map(g=>{
        const fecha=editados[`fecha-${g.sedeId}`]??estado.valores[`fecha-${g.sedeId}`]??fechaSugeridaEntrega(g.comuna),nombre=editados[`receptora-${g.sedeId}`]??estado.valores[`receptora-${g.sedeId}`]??g.directora??'',rut=editados[`rut-${g.sedeId}`]??estado.valores[`rut-${g.sedeId}`]??g.rut??'',correo=editados[`correo-${g.sedeId}`]??estado.valores[`correo-${g.sedeId}`]??g.correo??'';
        return <section className="grupo-entrega entrega-resumen" key={g.sedeId}>
          <input type="hidden" name={`sede-version-${g.sedeId}`} value={g.sedeVersion}/><div className="cabecera-entrega"><h2>{g.rbd?`${g.rbd} · `:''}{g.nombre}</h2><span>{g.equipos.length} {g.equipos.length===1?'equipo':'equipos'}</span></div>
          <dl className="datos-entrega-resumen"><div><dt>Comuna y fecha de entrega</dt><dd>{g.comuna||'Sin comuna'} · {fecha?fecha.split('-').reverse().join('/'):'Fecha pendiente'}</dd></div>
            <div><dt>Directora receptora</dt><dd>{nombre||'Pendiente de cargar en el directorio'}{rut&&<small> · RUN {rut}</small>}{correo&&<small> · {correo}</small>}</dd></div></dl>
          <details className="editar-entrega"><summary>✎ Editar datos de esta entrega</summary><div className="datos-entrega">
            <div className="campo-catalogos"><label htmlFor={`fecha-${g.sedeId}`}>Fecha real de entrega</label><input id={`fecha-${g.sedeId}`} name={`fecha-${g.sedeId}`} type="date" min="1900-01-01" max={hoy} required defaultValue={fecha} onChange={e=>setEditados(v=>({...v,[`fecha-${g.sedeId}`]:e.target.value}))}/></div>
            <div className="campo-catalogos"><label htmlFor={`receptora-${g.sedeId}`}>Directora que recibió</label><input id={`receptora-${g.sedeId}`} name={`receptora-${g.sedeId}`} required maxLength={200} defaultValue={nombre} onChange={e=>{const valor=e.target.value;setEditados(v=>({...v,[`receptora-${g.sedeId}`]:valor,[`rut-${g.sedeId}`]:valor===g.directora?g.rut??'':'',[`correo-${g.sedeId}`]:valor===g.directora?g.correo??'':''}));}}/><p className="ayuda-catalogos">Directora del jardín infantil. Un cambio aquí solo afecta esta entrega, no actualiza el directorio.</p></div>
            <div className="campo-catalogos"><label htmlFor={`rut-${g.sedeId}`}>RUN de quien recibió (opcional)</label><input id={`rut-${g.sedeId}`} name={`rut-${g.sedeId}`} maxLength={12} value={rut} onChange={e=>{const valor=e.target.value;setEditados(v=>({...v,[`rut-${g.sedeId}`]:valor}));}}/></div>
            <div className="campo-catalogos"><label htmlFor={`correo-${g.sedeId}`}>Correo de quien recibió (opcional)</label><input id={`correo-${g.sedeId}`} name={`correo-${g.sedeId}`} type="email" maxLength={254} value={correo} onChange={e=>{const valor=e.target.value;setEditados(v=>({...v,[`correo-${g.sedeId}`]:valor}));}}/></div>
            <div className="campo-catalogos"><label htmlFor={`acta-${g.sedeId}`}>Enlace al acta existente (opcional)</label><input id={`acta-${g.sedeId}`} name={`acta-${g.sedeId}`} type="url" maxLength={1500} defaultValue={estado.valores[`acta-${g.sedeId}`]??''}/></div>
          </div></details>
          {(g.direccion||g.correoInstitucional)&&<details><summary>Datos del establecimiento para la entrega</summary><p>{g.direccion||'Dirección sin informar'}{g.correoInstitucional?' · '+g.correoInstitucional:''}</p></details>}
          <details className="equipos-entrega"><summary>Ver los equipos seleccionados</summary><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos tabla-entrega"><thead><tr><th>Equipo</th><th>Serie</th><th>Inventario</th></tr></thead><tbody>{g.equipos.map(e=><tr key={e.id}><td>{e.marca} {e.modelo}</td><td>{e.serie||'Pendiente'}</td><td>{e.inventario||'Pendiente'}</td></tr>)}</tbody></table></div></details>
        </section>;
      })}
      <label className="confirmacion-entrega"><input type="checkbox" name="confirmo" value="si" required/> Confirmo que estos equipos ya fueron entregados y revisé sus responsables y fechas.</label>
      <button type="submit" className="boton-catalogos" disabled={pendiente||faltantes.length>0}>{pendiente?'Guardando…':`Confirmar ${equipos.length===1?'equipo entregado':`${equipos.length} equipos entregados`}`}</button>
    </fieldset><p role={estado.estado==='error'?'alert':'status'}>{estado.mensaje}</p>
  </form>;
}
