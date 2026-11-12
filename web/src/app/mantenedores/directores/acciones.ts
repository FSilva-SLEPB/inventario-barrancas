'use server';
import {createHash,randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {listarDirectorio} from '@/lib/directorio';
import {esIdSede} from '@/lib/validacion-sedes';
import {validarDatosDirectorio,prepararDirectorio,CAMPOS_DIRECTORIO,type DatosDirectorio,type VistaDirectorio} from '@/lib/validacion-directorio';
export type EstadoDirector={estado:'inicial'|'error'|'guardado';mensaje:string;valores:DatosDirectorio;version:number;sedeVersion:string;revision:string};
export async function guardarDirector(_anterior:EstadoDirector,f:FormData):Promise<EstadoDirector>{
 const actor=await exigirPermiso('directorio_personas','editar'),revision=randomUUID(),version=Number(f.get('version')),sedeVersion=f.get('sedeVersion'),sede=f.get('sede');
 const crudos:Record<string,unknown>={};for(const k of CAMPOS_DIRECTORIO)crudos[k]=f.get(k);
 const valores=Object.fromEntries(Object.entries(crudos).map(([k,v])=>[k,typeof v==='string'?v.slice(0,2000):''])) as DatosDirectorio;
 const fallo=(mensaje:string):EstadoDirector=>({estado:'error',mensaje,valores,version,sedeVersion:typeof sedeVersion==='string'?sedeVersion:'',revision});
 if(typeof sede!=='string'||!esIdSede(sede)||typeof sedeVersion!=='string'||sedeVersion.length>2000||!Number.isInteger(version)||version<0||version>2147483646||['sede','version','sedeVersion','motivo',...CAMPOS_DIRECTORIO].some(k=>f.getAll(k).length!==1))return fallo('Formulario inválido. Recarga el directorio.');
 let datos:DatosDirectorio;try{datos=validarDatosDirectorio(crudos);}catch(e){return fallo(e instanceof Error?e.message:'Revisa los datos.');}
 const motivo=f.get('motivo');if(typeof motivo!=='string'||!motivo.trim()||motivo.length>500||/\p{Cc}/u.test(motivo))return fallo('Indica brevemente el motivo de la actualización.');
 try{
  await obtenerBaseDatos().query<{version:number}>('SELECT public.guardar_ficha_directorio_acceso($1,$2::uuid,$3::jsonb,$4,$5,$6) AS version',[actor.email,sede,JSON.stringify(datos),version,sedeVersion,motivo.trim()]);
  revalidatePath('/directorio','layout');revalidatePath('/mantenedores','layout');revalidatePath('/inventario','layout');

 }catch(e){return fallo((e as {code?:string}).code==='P2201'?'El directorio o la sede cambiaron. Recarga antes de guardar.':'No se pudo actualizar el directorio. Revisa permisos y datos.');}
 redirect('/mantenedores/directores?ver='+sede);
}
export type EstadoCargaDirectorio={estado:'inicial'|'error'|'previa'|'guardado';mensaje:string;hash:string;versiones:string;vista:VistaDirectorio[];omitidas:{fila:number;rbd:string;sede:string;motivo:string}[]};
export async function cargarDirectorio(_anterior:EstadoCargaDirectorio,f:FormData):Promise<EstadoCargaDirectorio>{
 const actor=await exigirPermiso('directorio_personas','editar'),base:EstadoCargaDirectorio={estado:'error',mensaje:'',hash:'',versiones:'',vista:[],omitidas:[]};
 const archivo=f.get('archivo'),pegado=f.get('listado'),operacion=f.get('operacion');
 const esArchivo=archivo instanceof File&&archivo.size>0,esTexto=typeof pegado==='string'&&Boolean(pegado.trim());
 if(f.getAll('operacion').length!==1||!['previa','confirmar'].includes(String(operacion))||f.getAll('archivo').length>1||f.getAll('listado').length>1||esArchivo===esTexto||esArchivo&&(!(archivo instanceof File)||archivo.size>1024*1024||!/[.](csv|tsv|txt)$/i.test(archivo.name))||esTexto&&Buffer.byteLength(pegado as string)>1024*1024)return {...base,mensaje:'Selecciona un CSV/TSV/TXT o pega el listado con su cabecera, hasta 1 MB. Usa una sola fuente.'};
 try{
  const buffer=esArchivo?new Uint8Array(await(archivo as File).arrayBuffer()):new TextEncoder().encode(pegado as string),hash=createHash('sha256').update(buffer).digest('hex');
  if(operacion==='confirmar'&&(await obtenerBaseDatos().query('SELECT 1 FROM public.directorio_cargas WHERE sha256=$1',[hash])).rows.length)return {...base,estado:'guardado',mensaje:'El listado ya había sido cargado. No se duplicó el historial.'};
  const {datos,vista,omitidas}=prepararDirectorio(new TextDecoder('utf-8',{fatal:true}).decode(buffer),await listarDirectorio()),versiones=JSON.stringify(datos.map(d=>[d.sedeId,d.version,d.sedeVersion]));
  if(operacion==='previa')return {...base,estado:'previa',mensaje:`Revisa ${datos.length} establecimientos/JISC antes de confirmar. ${omitidas.length?`${omitidas.length} filas de Nivel Central se muestran aparte y no se cargarán.`:''}`,hash,versiones,vista,omitidas};
  if(f.getAll('hash').length!==1||f.get('hash')!==hash||f.getAll('versiones').length!==1||f.get('versiones')!==versiones||f.getAll('confirmo').length!==1||f.get('confirmo')!=='si')return {...base,mensaje:'El listado, el directorio o la sede cambiaron. Prepara nuevamente la vista previa y confirma su revisión.'};
  const nombre=esArchivo?(archivo as File).name.split(/[\\/]/).pop()!.replace(/[\p{Cc}]/gu,'').slice(0,200):'listado-pegado.txt';
  const {rows}=await obtenerBaseDatos().query<{resultado:{repetida:boolean}}>('SELECT public.cargar_directorio_acceso($1,$2::jsonb,$3,$4) AS resultado',[actor.email,JSON.stringify(datos),hash,nombre||'directorio.csv']);
  revalidatePath('/directorio','layout');revalidatePath('/mantenedores','layout');revalidatePath('/inventario','layout');
  return {...base,estado:'guardado',mensaje:rows[0].resultado.repetida?'El listado ya había sido cargado. No se duplicó el historial.':`Directorio cargado: ${datos.length} establecimientos/JISC, con historial.`,omitidas};
 }catch(e){const code=(e as {code?:string})?.code;if(code)return {...base,mensaje:code==='P2201'?'El directorio o una sede cambiaron durante la revisión. No se guardaron cambios parciales.':'No se pudo confirmar la carga; no se guardaron cambios parciales.'};return {...base,mensaje:e instanceof TypeError?'El archivo debe ser texto UTF-8.':e instanceof Error?e.message:'No se pudo revisar el listado.'};}
}
