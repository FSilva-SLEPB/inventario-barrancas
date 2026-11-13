'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import IconoAccion from '@/components/icono-accion';
import {mostrarExito} from '@/components/avisos-guardado';
import type {FotoSede} from '@/lib/fotos-sedes';
export default function FotoEstablecimiento({sede,nombre,foto,editable,entidad='sede'}:{sede:string;nombre:string;foto:FotoSede|null;editable:boolean;entidad?:'sede'|'funcionario'}){
 const personal=entidad==='funcionario',etiqueta=personal?'del funcionario':'del establecimiento',api=personal?'/api/funcionarios/foto':'/api/sedes/foto';
 const archivo=useRef<HTMLInputElement>(null),router=useRouter(),[pendiente,setPendiente]=useState(false),[error,setError]=useState(''),[reintentar,setReintentar]=useState(false),[guardada,setGuardada]=useState<FotoSede|null>(null);
 const actualFoto=guardada&&guardada.version>(foto?.version??0)?guardada:foto;
 const intento=useRef<{archivo:File;solicitud:string;version:number}|null>(null);
 const subir=async(file:File)=>{
  if(pendiente)return;setPendiente(true);setError('');setReintentar(false);
  if(intento.current?.archivo!==file)intento.current={archivo:file,solicitud:crypto.randomUUID(),version:actualFoto?.version??0};
  const actual=intento.current;
  try{const f=new FormData();f.set(personal?'funcionario':'sede',sede);f.set('solicitud',actual.solicitud);f.set('version',String(actual.version));f.set('imagen',file);const r=await fetch(api,{method:'POST',body:f}),j=await r.json();if(!r.ok){intento.current=null;if(r.status===409)router.refresh();throw new Error(j.error||'No se pudo guardar la fotografía.');}intento.current=null;setGuardada({id:j.id,version:j.version});router.refresh();await mostrarExito('Fotografía guardada','La fotografía se actualizó correctamente.');}
  catch(e){setReintentar(Boolean(intento.current));setError(e instanceof Error?e.message:'Error de conexión. Vuelve a intentarlo.');}
  finally{setPendiente(false);}
 };
 return <section className="foto-establecimiento" aria-label={'Fotografía '+etiqueta} aria-busy={pendiente}><h3>Fotografía</h3>{actualFoto?<img className="foto-establecimiento-imagen" src={api+'?id='+actualFoto.id+(personal?'&funcionario='+sede:'')} alt={'Fotografía de '+nombre}/>:<div className="foto-establecimiento-vacia"><IconoAccion tipo="foto"/><span>Sin fotografía</span></div>}{editable&&<><input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" aria-label={'Seleccionar fotografía '+etiqueta} hidden disabled={pendiente} onChange={e=>{const file=e.target.files?.[0];if(file)void subir(file);}}/><button type="button" className="btn btn-outline-primary" disabled={pendiente} onClick={()=>{if(archivo.current){archivo.current.value='';archivo.current.click();}}}><IconoAccion tipo="foto"/> {pendiente?'Guardando…':actualFoto?'Cambiar fotografía':'Subir fotografía'}</button><p className="ayuda-catalogos">JPG, PNG o WEBP · Máximo 5 MB.</p></>}{error&&<p role="alert" className="error-catalogos">{error}</p>}{editable&&reintentar&&<button type="button" className="btn btn-outline-primary" disabled={pendiente} onClick={()=>{const a=intento.current;if(a)void subir(a.archivo);}}>Reintentar subida</button>}</section>;
}
