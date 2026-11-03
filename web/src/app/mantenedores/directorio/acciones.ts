'use server';
import {destinoConExito} from '@/lib/aviso-exito';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {listarDirectorio} from '@/lib/directorio';
import {obtenerBaseDatos} from '@/lib/db';
import {datosDesdeSede,validarDatosDirectorio} from '@/lib/validacion-directorio';
import {SECCIONES_DIRECTORIO,esSeccionDirectorio,enlaceDirectorio} from '@/lib/secciones-directorio';
export type EstadoFichaDirectorio={estado:'inicial'|'error';mensaje:string;valores:Record<string,string>;revision:string};
export async function guardarFichaDirectorio(_anterior:EstadoFichaDirectorio,f:FormData):Promise<EstadoFichaDirectorio>{
 const actor=await exigirAdministrador(),revision=randomUUID(),valores:Record<string,string>={};
 for(const k of ['rbd','sedeNombre','direccion','comuna','correoInstitucional','nombres','apellidos','rut','correo','situacion','motivo']){const v=f.get(k);valores[k]=typeof v==='string'?v.slice(0,2000):'';}
 const fallo=(mensaje:string):EstadoFichaDirectorio=>({estado:'error',mensaje,valores,revision});
 const seccion=f.get('seccion'),sede=f.get('sede'),sedeVersion=f.get('sedeVersion'),version=Number(f.get('version')),filtros=f.get('filtros');
 if(!esSeccionDirectorio(seccion)||typeof sede!=='string'||typeof sedeVersion!=='string'||sedeVersion.length>2000||!Number.isInteger(version)||version<0||version>2147483646||typeof filtros!=='string'||filtros.length>2000)return fallo('Formulario inválido. Vuelve a abrir la ficha.');
 const config=SECCIONES_DIRECTORIO[seccion],campos=config.personas?['nombres','apellidos','rut','situacion',...(config.correo?['correo']:[])]:['rbd','sedeNombre','direccion','comuna','correoInstitucional'];
 const permitidos=['seccion','sede','sedeVersion','version','filtros','motivo',...campos];
 if(permitidos.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!permitidos.includes(k)&&!k.startsWith('$ACTION')))return fallo('El formulario contiene campos inválidos. Vuelve a abrir la ficha.');
 const actual=(await listarDirectorio()).find(d=>d.sedeId===sede&&d.tipo===config.tipo);if(!actual)return fallo('La ficha no corresponde a esta sección o ya no está disponible.');
 if(!valores.motivo.trim()||valores.motivo.length>500||/\p{Cc}/u.test(valores.motivo))return fallo('Indica brevemente el motivo del cambio.');
 let datos:Record<string,string>;
 try{
  if(config.personas){
   const activo=['titular','subrogante'].includes(valores.situacion),nombres=activo?valores.nombres.normalize('NFC').trim().replace(/ +/g,' '):'',apellidos=activo?valores.apellidos.normalize('NFC').trim().replace(/ +/g,' '):'';
   if(activo&&(!nombres||!apellidos||nombres.length>100||apellidos.length>100||/[\p{Cc}]/u.test(nombres+apellidos)))return fallo('Revisa los nombres y apellidos: ambos son obligatorios para una persona vigente, hasta 100 caracteres cada uno.');
   const nombre=activo?nombres+' '+apellidos:'',correo=activo?(config.correo?valores.correo:nombre===actual.nombre?actual.correo??'':''):'';
   datos={...validarDatosDirectorio({...datosDesdeSede(actual),nombre,rut:activo?valores.rut:'',correo,situacion:valores.situacion}),nombres,apellidos};
  }else{
   if(valores.rbd.length>30||/\p{Cc}/u.test(valores.rbd))return fallo('Revisa el RBD: hasta 30 caracteres, sin saltos de línea.');
   const d=validarDatosDirectorio({...datosDesdeSede(actual),...Object.fromEntries(campos.filter(k=>k!=='rbd').map(k=>[k,valores[k]]))});
   datos={rbd:valores.rbd.trim(),sedeNombre:d.sedeNombre,direccion:d.direccion,comuna:d.comuna,correoInstitucional:d.correoInstitucional};
  }
 }catch(e){return fallo(e instanceof Error?e.message:'Revisa los datos de la ficha.');}
 try{
  if(config.personas)await obtenerBaseDatos().query('SELECT public.guardar_ficha_directorio_acceso($1,$2::uuid,$3::jsonb,$4,$5,$6)',[actor.email,sede,JSON.stringify(datos),version,sedeVersion,valores.motivo.trim()]);
  else await obtenerBaseDatos().query('SELECT public.guardar_sede_directorio_acceso($1,$2::uuid,$3::jsonb,$4,$5)',[actor.email,sede,JSON.stringify(datos),sedeVersion,valores.motivo.trim()]);
 }catch(e){const codigo=(e as {code?:string}).code;return fallo(codigo==='P2201'?'La ficha cambió mientras la editabas. Recarga antes de guardar.':codigo==='23505'?'El RBD ya está registrado en otra sede.':'No se pudo guardar la ficha. Revisa permisos y datos.');}
 revalidatePath('/directorio','layout');revalidatePath('/mantenedores','layout');revalidatePath('/inventario','layout');
 redirect(destinoConExito(enlaceDirectorio(seccion,filtros),'contacto'));
}
