"use client";
import {COLUMNAS_CARGA_INVENTARIO} from '@/lib/columnas-carga-inventario';
import {useResultadoGuardado} from '@/components/avisos-guardado';
import { useActionState,useState } from "react";
import { procesarCarga,type EstadoCarga } from "@/app/inventario/carga/acciones";
export default function FormularioCargaEquipos() {
  const [archivo,setArchivo]=useState<File|null>(null);
  const [archivoRevisado,setArchivoRevisado]=useState<File|null>(null);
  const base:EstadoCarga={estado:"inicial",mensaje:"",hash:"",total:0,errores:[],avisos:[],cantidadAvisos:0,vistas:[]};
  const [estado,accion,pendiente]=useActionState(async(anterior:EstadoCarga,f:FormData)=>{
    if(archivo)f.set("archivo",archivo);
    const resultado=await procesarCarga(anterior,f);
    setArchivoRevisado(resultado.estado==="previa"?archivo:null);
    return resultado;
  },base);
 useResultadoGuardado(estado);
  return <form action={accion} aria-busy={pendiente} className="formulario-catalogos carga-equipos">
    <div className="campo-catalogos"><label htmlFor="carga-archivo">Archivo CSV UTF-8 (hasta 2 MB)</label>
      <input id="carga-archivo" name="archivo" type="file" accept=".csv,text/csv" disabled={pendiente}
        onChange={e=>{setArchivo(e.target.files?.[0]??null);setArchivoRevisado(null);}}/></div>
    {archivo&&<p>Archivo seleccionado: {archivo.name}</p>}
    <input type="hidden" name="hash" value={estado.hash}/>
    <button type="submit" name="operacion" value="previa" disabled={pendiente||!archivo} className="boton-catalogos">Preparar vista previa</button>
    <p role={estado.estado==="error"?"alert":"status"}>{pendiente?"Procesando…":estado.mensaje}</p>
    {estado.total>0&&<p>Total: {estado.total} bienes individuales{estado.filas!==undefined?` en ${estado.filas} filas`:null}. Avisos: {estado.cantidadAvisos}.</p>}
    {estado.errores.length>0&&<ul>{estado.errores.map((s,i)=><li key={i}>{s}</li>)}</ul>}
    {estado.avisos.length>0&&<details><summary>Avisos de información pendiente (primeros 30)</summary><ul>{estado.avisos.map((s,i)=><li key={i}>{s}</li>)}</ul></details>}
    {estado.vistas.length>0&&<div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption>Primeras 20 filas</caption>
      <thead><tr><th>Fila / RBD</th><th>Equipo</th><th>Serie / inventario</th><th>Cantidad</th><th>Estados declarados</th></tr></thead>
      <tbody>{estado.vistas.map(v=><tr key={v.fila}><td>{v.fila} / {v.rbd}</td><td>{v.categoria} · {v.marca} {v.modelo}</td><td>{v.serie||"Pendiente"} / {v.inventario||"Pendiente"}</td><td>{v.cantidad??1}</td><td>{v.estado}</td></tr>)}</tbody>
    </table></div>}
    {estado.vistas.some(v=>v.antecedentes)&&<details><summary>Revisar las 23 columnas originales de la planilla (primeras 20 filas)</summary><div className="tabla-usuarios-contenedor" role="region" aria-label="Datos originales de la carga" tabIndex={0}><table className="tabla-datos tabla-catalogos"><thead><tr>{COLUMNAS_CARGA_INVENTARIO.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{estado.vistas.map(v=><tr key={v.fila}>{COLUMNAS_CARGA_INVENTARIO.map(c=><td key={c}>{v.antecedentes?.[c]||'Sin informar'}</td>)}</tr>)}</tbody></table></div></details>}
    {estado.estado==="previa"&&archivoRevisado===archivo&&<div className="panel-catalogos">
      <label><input type="checkbox" name="aceptarAvisos" value="si" disabled={pendiente}/> Revisé los equipos y los avisos; acepto conservar los datos históricos pendientes.</label>
      <p>Se volverá a validar el archivo y la disponibilidad de sus identificadores. Un error cancela toda la carga.</p>
      <button type="submit" name="operacion" value="confirmar" className="boton-catalogos" disabled={pendiente||!archivo}>Confirmar carga completa</button>
    </div>}
  </form>;
}
