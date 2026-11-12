'use client';
import {useRef,useState,useSyncExternalStore} from 'react';
import {gestionarReporteIncidente} from '@/app/inventario/incidentes/acciones';
import type {BienReporte,DatosReporte,ReporteIncidente} from '@/lib/reportes-incidentes';
import {mostrarExito} from '@/components/avisos-guardado';
import type {Sede} from '@/lib/validacion-sedes';
const suscribir=()=>()=>{};
export default function FormularioReporteIncidente({reporte,bienes,sedes,volver,admin,preseleccion}:{reporte?:ReporteIncidente;bienes:BienReporte[];sedes:Sede[];volver:string;admin:boolean;preseleccion?:string}){
 const listo=useSyncExternalStore(suscribir,()=>true,()=>false);
 const [datos,setDatos]=useState<DatosReporte>(reporte?.datos??{sedeId:sedes.length===1?sedes[0].id:'',tipo:'robo',fecha:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),parte:'',denunciante:'',rut:'',descripcion:'',bienes:bienes.filter(b=>b.id===preseleccion)});
 const [envioPendiente,setEnvioPendiente]=useState(false),[version,setVersion]=useState(reporte?.version??0),[ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[archivos,setArchivos]=useState<{id:string;archivo:File}[]>([]);
 const id=useRef(reporte?.id??''),operacion=useRef(''),envio=useRef<{id:string;version:number}|null>(null),[estado,setEstado]=useState(reporte?.estado??'borrador');
 const borrador=estado==='borrador';const disponibles=[...bienes,...(reporte?.datos.bienes??[]).filter(b=>!bienes.some(x=>x.id===b.id&&x.clase===b.clase)).map(b=>({...b,sedeId:datos.sedeId}))].filter(b=>b.sedeId===datos.sedeId);
 async function guardar(enviar:boolean){
  if(ocupado)return;setOcupado(true);setError('');id.current||=crypto.randomUUID();operacion.current||=crypto.randomUUID();
  try{
   let actual=version;
   if(borrador&&!envio.current){const r=await gestionarReporteIncidente(operacion.current,id.current,actual,'guardar',datos);if(!r.ok)throw Error(r.mensaje);actual=r.version;setVersion(actual);operacion.current='';}
   for(const x of archivos){const f=new FormData();f.set('id',x.id);f.set('reporte',id.current);f.set('archivo',x.archivo);const r=await fetch('/api/inventario/incidentes/adjuntos',{method:'POST',body:f});if(!r.ok)throw Error((await r.json()).error);}
   setArchivos([]);
   enviar=enviar||Boolean(envio.current);
   const faltaparte=datos.tipo!=='dano'&&!datos.parte.trim();
   if(enviar&&borrador&&!faltaparte){envio.current??={id:crypto.randomUUID(),version:actual};setEnvioPendiente(true);const r=await gestionarReporteIncidente(envio.current.id,id.current,envio.current.version,'enviar',{});if(!r.ok){envio.current=null;setEnvioPendiente(false);throw Error(r.mensaje);}envio.current=null;setEnvioPendiente(false);setEstado('enviado');setVersion(r.version);operacion.current='';}
   await mostrarExito(faltaparte?'Borrador guardado':'Reporte guardado',faltaparte?'El proceso continuará cuando ingreses el número de parte. Puedes volver a abrir este borrador.':enviar?'Enviado a TI. Si falta el informe, quedará pendiente para adjuntarlo después.':'Los datos y archivos fueron guardados.');window.location.assign(volver);
  }catch(e){setError(envio.current?'No se pudo confirmar el envío. Reintenta Enviar a TI para comprobar el mismo envío, sin duplicarlo.':e instanceof Error?e.message:'No se pudo guardar. Revisa el reporte.');}finally{setOcupado(false);}
 }
 const campo=(k:'fecha'|'parte'|'denunciante'|'rut',label:string,tipo='text',required=false)=><div className="campo-catalogos"><label htmlFor={'reporte-'+k}>{label}{required?' *':''}</label><input id={'reporte-'+k} type={tipo} required={required} maxLength={k==='parte'?120:k==='rut'?12:200} value={datos[k]} onChange={e=>{setDatos({...datos,[k]:e.target.value});operacion.current='';}}/></div>;
 return <form className="formulario-catalogos" aria-busy={ocupado} onSubmit={e=>{e.preventDefault();void guardar(true);}}><fieldset className="border-0 p-0" disabled={ocupado||!listo}><fieldset className="border-0 p-0" disabled={!borrador||envioPendiente}>
 <div className="campo-catalogos"><label htmlFor="reporte-sede">Establecimiento / sede *</label><select id="reporte-sede" required value={datos.sedeId} onChange={e=>setDatos({...datos,sedeId:e.target.value,bienes:[]})}><option value="">Selecciona</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.rbd? s.rbd+' · ':''}{s.nombre}</option>)}</select></div>
 <div className="campo-catalogos"><label htmlFor="reporte-tipo">Tipo de incidente *</label><select id="reporte-tipo" value={datos.tipo} onChange={e=>setDatos({...datos,tipo:e.target.value as DatosReporte['tipo']})}><option value="robo">Robo</option><option value="sustraccion">Sustracción</option><option value="dano">Daño / equipo quebrado</option></select></div>
 {campo('fecha',datos.tipo==='dano'?'Fecha del daño':'Fecha del robo','date',true)}
 {datos.tipo!=='dano'&&<>{campo('parte','Número de parte')}{campo('denunciante','Persona que realizó la denuncia')}{campo('rut','RUT de quien realizó la denuncia')}<p className="ayuda-catalogos">El número de parte, nombre y RUT son necesarios para enviar a TI. Sin parte se guarda como borrador; el informe puede adjuntarse después.</p></>}
 <div className="campo-catalogos"><label htmlFor="reporte-descripcion">Descripción *</label><textarea id="reporte-descripcion" required maxLength={2000} value={datos.descripcion} onChange={e=>setDatos({...datos,descripcion:e.target.value})}/></div>
 <fieldset><legend>Selecciona uno o varios equipos *</legend>{disponibles.map(b=><label className="d-block mb-2" key={b.clase+b.id}><input type="checkbox" checked={datos.bienes.some(x=>x.id===b.id&&x.clase===b.clase)} onChange={e=>setDatos({...datos,bienes:e.target.checked?[...datos.bienes,b]:datos.bienes.filter(x=>x.id!==b.id||x.clase!==b.clase)})}/> {b.clase==='celular'?'Celular':'Equipo'} · {b.marca} {b.modelo} · {b.inventario||b.serie||'Sin identificador'}</label>)}{!disponibles.length&&<p>No hay bienes disponibles para reportar en esta sede.</p>}</fieldset>
 </fieldset>
 <div className="campo-catalogos"><label htmlFor="reporte-archivos">Adjuntar denuncia o informe fiscal (opcional)</label><input id="reporte-archivos" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setArchivos(Array.from(e.target.files??[]).map(archivo=>({id:crypto.randomUUID(),archivo})))}/><p className="ayuda-catalogos">PDF hasta 10 MB; imágenes hasta 5 MB. Máximo cinco archivos y 25 MB por reporte. Los archivos se guardan al confirmar.</p></div>
 <p>* Estos datos son obligatorios. El reporte no cambia el estado del bien hasta la validación de TI.</p><div className="acciones-catalogos">{borrador?<><button type="submit" className="btn btn-primary">{ocupado?'Guardando…':'Enviar a TI'}</button><button type="button" className="btn btn-outline-primary" onClick={()=>void guardar(false)}>Guardar borrador</button></>:<button type="button" className="btn btn-primary" onClick={()=>void guardar(false)}>Guardar adjuntos</button>}</div>
 {admin&&reporte&&estado==='enviado'&&<RevisionReporte id={reporte.id} version={version} volver={volver}/>}</fieldset><p role="alert">{error}</p></form>;
}
function RevisionReporte({id,version,volver}:{id:string;version:number;volver:string}){
 const [motivo,setMotivo]=useState(''),[ocupado,setOcupado]=useState(false),[error,setError]=useState(''),sol=useRef('');
 async function resolver(accion:'validar'|'rechazar'){if(ocupado)return;setOcupado(true);sol.current||=crypto.randomUUID();try{const r=await gestionarReporteIncidente(sol.current,id,version,accion,{motivo});if(!r.ok){setError(r.mensaje);return;}await mostrarExito('Revisión de TI guardada',accion==='validar'?'Reporte validado y estados actualizados.':'Reporte rechazado; se conservan los estados de los bienes.');window.location.assign(volver);}catch{setError('No se pudo confirmar la revisión. Reintenta la misma decisión o vuelve a abrir el reporte.');}finally{setOcupado(false);}}
 return <fieldset disabled={ocupado}><legend>Validación de TI</legend><label htmlFor="revision-motivo">Resultado de la revisión *</label><textarea id="revision-motivo" maxLength={500} value={motivo} onChange={e=>{setMotivo(e.target.value);sol.current='';}}/><div className="acciones-catalogos"><button type="button" disabled={!motivo.trim()} className="btn btn-primary" onClick={()=>void resolver('validar')}>Validar por TI</button><button type="button" disabled={!motivo.trim()} className="btn btn-outline-danger" onClick={()=>void resolver('rechazar')}>Rechazar</button></div><p role="alert">{error}</p></fieldset>;
}
