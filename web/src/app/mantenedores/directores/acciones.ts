"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/acceso";
import { obtenerBaseDatos } from "@/lib/db";
import { listarDirectorio } from "@/lib/directorio";
import { esIdSede } from "@/lib/validacion-sedes";
import { nombreResponsable, prepararDirectorio } from "@/lib/validacion-directorio";
export type EstadoDirector={estado:'inicial'|'error'|'guardado';mensaje:string;nombre:string;version:number};
export async function guardarDirector(_anterior:EstadoDirector,f:FormData):Promise<EstadoDirector>{
  const actor=await exigirAdministrador();let nombre='';const version=Number(f.get('version'));
  const fallo=(mensaje:string):EstadoDirector=>({estado:'error',mensaje,nombre,version});
  const sede=f.get('sede');
  if(typeof sede!=='string'||!esIdSede(sede)||!Number.isInteger(version)||version<0||version>2147483646||['sede','nombre','version','motivo'].some(k=>f.getAll(k).length!==1))return fallo('Formulario inválido. Recarga el directorio.');
  try{nombre=nombreResponsable(f.get('nombre'));}catch(e){return fallo((e as Error).message);}
  const motivo=f.get('motivo');if(typeof motivo!=='string'||!motivo.trim()||motivo.length>500||/\p{Cc}/u.test(motivo))return fallo('Indica brevemente el motivo de la actualización.');
  try{
    const {rows}=await obtenerBaseDatos().query<{version:number}>('SELECT public.guardar_director_acceso($1,$2::uuid,$3,$4,$5) AS version',[actor.email,sede,nombre,version,motivo.trim()]);
    revalidatePath('/mantenedores/directores');revalidatePath('/inventario','layout');
    return {estado:'guardado',mensaje:'Directorio actualizado. Las entregas anteriores conservan su receptora original.',nombre,version:rows[0].version};
  }catch(e){const code=(e as {code?:string}).code;return fallo(code==='P2201'?'El directorio cambió. Recarga antes de guardar.':'No se pudo actualizar el directorio. Revisa permisos y sede.');}
}
export type EstadoCargaDirectorio={estado:'inicial'|'error'|'previa'|'guardado';mensaje:string;hash:string;versiones:string;vista:{rbd:string;sede:string;anterior:string;nuevo:string}[]};
export async function cargarDirectorio(_anterior:EstadoCargaDirectorio,f:FormData):Promise<EstadoCargaDirectorio>{
  const actor=await exigirAdministrador();const base:EstadoCargaDirectorio={estado:'error',mensaje:'',hash:'',versiones:'',vista:[]};
  const archivo=f.get('archivo'),operacion=f.get('operacion');
  if(!(archivo instanceof File)||!archivo.size||archivo.size>1024*1024||!/\.csv$/i.test(archivo.name)||f.getAll('archivo').length!==1||f.getAll('operacion').length!==1||!['previa','confirmar'].includes(String(operacion)))return {...base,mensaje:'Selecciona un CSV UTF-8 de hasta 1 MB.'};
  try{
    const buffer=await archivo.arrayBuffer(),hash=createHash('sha256').update(new Uint8Array(buffer)).digest('hex');
    if(operacion==='confirmar'&&(await obtenerBaseDatos().query('SELECT 1 FROM public.directorio_cargas WHERE sha256=$1',[hash])).rows.length)return {...base,estado:'guardado',mensaje:'El archivo ya había sido cargado. No se duplicó el historial.'};
    const {datos,vista}=prepararDirectorio(new TextDecoder('utf-8',{fatal:true}).decode(buffer),await listarDirectorio());
    const versiones=JSON.stringify(datos.map(d=>[d.sedeId,d.version]));
    if(operacion==='previa')return {...base,estado:'previa',mensaje:`Revisa ${datos.length} responsables antes de confirmar.`,hash,versiones,vista};
    if(f.getAll('hash').length!==1||f.get('hash')!==hash||f.getAll('versiones').length!==1||f.get('versiones')!==versiones||f.getAll('confirmo').length!==1||f.get('confirmo')!=='si')return {...base,mensaje:'El archivo o el directorio cambió. Prepara nuevamente la vista previa y confirma su revisión.'};
    const nombre=archivo.name.split(/[\\/]/).pop()!.replace(/[\p{Cc}]/gu,'').slice(0,200)||'directorio.csv';
    const {rows}=await obtenerBaseDatos().query<{resultado:{repetida:boolean}}>('SELECT public.cargar_directorio_acceso($1,$2::jsonb,$3,$4) AS resultado',[actor.email,JSON.stringify(datos),hash,nombre]);
    revalidatePath('/mantenedores/directores');revalidatePath('/inventario','layout');
    return {...base,estado:'guardado',mensaje:rows[0].resultado.repetida?'El archivo ya había sido cargado. No se duplicó el historial.':`Directorio cargado: ${datos.length} responsables, con historial.`};
  }catch(e){const code=(e as {code?:string})?.code;if(code)return {...base,mensaje:code==='P2201'?'El directorio cambió durante la revisión. No se guardaron cambios parciales.':'No se pudo confirmar la carga; no se guardaron cambios parciales.'};return {...base,mensaje:e instanceof TypeError?'El archivo debe ser CSV UTF-8.':e instanceof Error?e.message:'No se pudo revisar el CSV.'};}
}
