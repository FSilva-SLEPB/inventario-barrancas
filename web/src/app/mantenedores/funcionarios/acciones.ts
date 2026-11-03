'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {CAMPOS_FUNCIONARIO,validarFuncionario,type DatosFuncionario} from '@/lib/validacion-funcionarios';
export type EstadoFuncionario={estado:'inicial'|'error'|'guardado';mensaje:string;id:string;version:number;valores:DatosFuncionario;revision:string;motivo:string};
export async function guardarFuncionario(_anterior:EstadoFuncionario,f:FormData):Promise<EstadoFuncionario>{
 const actor=await exigirAdministrador(),revision=randomUUID(),crudos:Record<string,unknown>={};for(const k of CAMPOS_FUNCIONARIO)crudos[k]=f.get(k);
 crudos.activo=f.get('activo')==='si'?true:f.get('activo')==='no'?false:null;
 const valores={...Object.fromEntries(CAMPOS_FUNCIONARIO.map(k=>[k,typeof crudos[k]==='string'?crudos[k].slice(0,500):''])),activo:crudos.activo===true} as DatosFuncionario;
 const id=f.get('id'),version=Number(f.get('version')),motivo=f.get('motivo'),idSeguro=typeof id==='string'&&esIdSede(id)?id:randomUUID();
 const fallo=(mensaje:string):EstadoFuncionario=>({estado:'error',mensaje,id:idSeguro,version:Number.isInteger(version)&&version>=0?version:0,valores,revision,motivo:typeof motivo==='string'?motivo.slice(0,500):''});
 const permitidos=['id','version','motivo','activo',...CAMPOS_FUNCIONARIO];
 if([...f.keys()].some(k=>!permitidos.includes(k)&&!k.startsWith('$ACTION')))return fallo('El formulario contiene campos no permitidos. Recarga la ficha.');
 if(typeof id!=='string'||!esIdSede(id)||!Number.isInteger(version)||version<0||version>=2147483647||['id','version','motivo','activo',...CAMPOS_FUNCIONARIO].some(k=>f.getAll(k).length!==1))return fallo('Formulario inválido. Recarga la ficha.');
 if(typeof motivo!=='string'||!motivo.trim()||motivo.length>500||/\p{Cc}/u.test(motivo))return fallo('Indica brevemente el motivo del cambio.');
 let datos:DatosFuncionario;try{datos=validarFuncionario(crudos);}catch(e){return fallo(e instanceof Error?e.message:'Revisa los datos del funcionario.');}
 try{
  const {rows}=await obtenerBaseDatos().query<{resultado:{id:string;version:number;repetida:boolean}}>('SELECT public.guardar_funcionario_nc_acceso($1,$2::uuid,$3::jsonb,$4,$5) AS resultado',[actor.email,id,JSON.stringify(datos),version,motivo.trim()]);
  revalidatePath('/mantenedores/funcionarios');
  return {estado:'guardado',mensaje:rows[0].resultado.repetida?'La ficha ya estaba guardada con estos datos.':'Ficha guardada. El historial conserva los cambios.',id:rows[0].resultado.id,version:rows[0].resultado.version,valores:datos,revision,motivo:'Actualización de ficha'};
 }catch(e){const codigo=(e as {code?:string}).code;return fallo(codigo==='P2401'?'La ficha cambió mientras la editabas. Recarga antes de guardar.':codigo==='23505'?'El RUN o correo ya tiene una ficha. Revisa el registro existente.':'No se pudo guardar la ficha. Revisa permisos y datos.');}
}
