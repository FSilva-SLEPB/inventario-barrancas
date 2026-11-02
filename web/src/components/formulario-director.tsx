"use client";
import { useActionState, useState } from "react";
import { guardarDirector, cargarDirectorio, type EstadoDirector, type EstadoCargaDirectorio } from "@/app/mantenedores/directores/acciones";
import type { DirectorSede } from "@/lib/directorio";
export default function FormularioDirector({ director }: {director:DirectorSede}) {
  const [estado,accion,pendiente]=useActionState(guardarDirector,{estado:'inicial',mensaje:'',nombre:director.nombre??'',version:director.version} as EstadoDirector);
  return <form action={accion} className="formulario-catalogos" aria-busy={pendiente}>
    <input type="hidden" name="sede" value={director.sedeId}/><input type="hidden" name="version" value={estado.version}/>
    <p><strong>{director.rbd} · {director.sedeNombre}</strong></p>
    <div className="campo-catalogos"><label htmlFor="director-nombre">Nombre completo</label><input id="director-nombre" name="nombre" maxLength={200} required defaultValue={estado.nombre} disabled={pendiente}/></div>
    <p>{director.tipo==='jardin_infantil'?'Directora del jardín infantil':'Director/a del establecimiento'}</p>
    <div className="campo-catalogos"><label htmlFor="director-motivo">Motivo de la actualización</label><input id="director-motivo" name="motivo" maxLength={500} required defaultValue={director.version?'Actualización del directorio':'Registro inicial'} disabled={pendiente}/></div>
    <button className="boton-catalogos" disabled={pendiente}>{pendiente?'Guardando…':'Guardar responsable'}</button><p role={estado.estado==='error'?'alert':'status'}>{estado.mensaje}</p>
  </form>;
}
export function CargaDirectorio(){
  const [archivo,setArchivo]=useState<File|null>(null),[revisado,setRevisado]=useState<File|null>(null);
  const [estado,accion,pendiente]=useActionState(async(prev:EstadoCargaDirectorio,f:FormData)=>{
    if(archivo)f.set('archivo',archivo);const resultado=await cargarDirectorio(prev,f);setRevisado(resultado.estado==='previa'?archivo:null);return resultado;
  },{estado:'inicial',mensaje:'',hash:'',versiones:'',vista:[]} as EstadoCargaDirectorio);
  return <form action={accion} aria-busy={pendiente}>
    <div className="campo-catalogos"><label htmlFor="directorio-csv">CSV del directorio (hasta 1 MB)</label><input id="directorio-csv" type="file" name="archivo" accept=".csv,text/csv" disabled={pendiente} onChange={e=>{setArchivo(e.target.files?.[0]??null);setRevisado(null);}}/></div>
    <input type="hidden" name="hash" value={estado.hash}/><input type="hidden" name="versiones" value={estado.versiones}/>
    <button className="btn btn-outline-primary" type="submit" name="operacion" value="previa" disabled={pendiente||!archivo}>Revisar archivo</button>
    <p role={estado.estado==='error'?'alert':'status'}>{estado.mensaje}</p>
    {estado.vista.length>0&&<div className="tabla-usuarios-contenedor"><table className="tabla-catalogos tabla-directorio"><caption>Comparación antes de cargar</caption><thead><tr><th>RBD</th><th>Establecimiento/JISC</th><th>Actual</th><th>Desde el archivo</th></tr></thead>
      <tbody>{estado.vista.map(v=><tr key={v.rbd}><td>{v.rbd}</td><td>{v.sede}</td><td>{v.anterior}</td><td>{v.nuevo}</td></tr>)}</tbody></table></div>}
    {estado.estado==='previa'&&archivo===revisado&&<div className="confirmacion-directorio"><label><input type="checkbox" name="confirmo" value="si" required disabled={pendiente}/> Revisé la correspondencia de cada RBD y responsable.</label><button className="boton-catalogos" name="operacion" value="confirmar" disabled={pendiente}>Confirmar carga del directorio</button></div>}
  </form>;
}
