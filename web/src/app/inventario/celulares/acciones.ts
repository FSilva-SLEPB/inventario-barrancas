'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {exigirGestionDependencias} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {retornoMovimiento} from '@/lib/validacion-movimientos-inventario';
import {destinoConExito} from '@/lib/aviso-exito';
import {CAMPOS_CELULAR,celularVacio,validarCelular,enlaceCelulares,type DatosCelular} from '@/lib/validacion-celulares';
export type EstadoCelular={estado:'inicial'|'error';mensaje:string;valores:DatosCelular;id:string;version:number;revision:string;motivo:string;custodiaInicial?:string};
export async function guardarCelular(_anterior:EstadoCelular,f:FormData):Promise<EstadoCelular>{
 const actor=await exigirGestionDependencias(),revision=randomUUID(),crudos:Record<string,unknown>={},valores=celularVacio();
 for(const k of CAMPOS_CELULAR){crudos[k]=f.get(k);valores[k]=typeof crudos[k]==='string'?crudos[k].slice(0,2500):'';}
 crudos.activo=f.get('activo')==='si'?true:f.get('activo')==='no'?false:null;valores.activo=crudos.activo===true;
 const id=f.get('id'),version=Number(f.get('version')),motivo=f.get('motivo'),filtros=f.get('filtros');
 const fallo=(mensaje:string):EstadoCelular=>({estado:'error',mensaje,valores,custodiaInicial:f.get('custodiaInicial')==='asignado'?'asignado':'en_bodega',id:typeof id==='string'&&esIdSede(id)?id:randomUUID(),version:Number.isInteger(version)&&version>=0?version:0,revision,motivo:typeof motivo==='string'?motivo.slice(0,500):''});
 const permitidos=['id','version','motivo','filtros','activo',...CAMPOS_CELULAR];
 const destinos=f.getAll('volver'),volver=destinos.length===1&&typeof destinos[0]==='string'?retornoMovimiento(destinos[0]):null;if(destinos.length>1||destinos.length&&!volver)return fallo('El regreso a la consulta no es válido.');
 const inicial=f.getAll('custodiaInicial');if(inicial.length>1||inicial.length&&(!['en_bodega','asignado'].includes(String(inicial[0]))||version>0))return fallo('Estado inicial inválido.');
 if(permitidos.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!permitidos.includes(k)&&k!=='custodiaInicial'&&k!=='volver'&&!k.startsWith('$ACTION'))||typeof id!=='string'||!esIdSede(id)||!Number.isInteger(version)||version<0||version>=2147483647||typeof filtros!=='string'||filtros.length>2000)return fallo('Formulario inválido. Vuelve a abrir la ficha.');
 if(typeof motivo!=='string'||!motivo.trim()||motivo.length>500||/\p{Cc}/u.test(motivo))return fallo('Indica brevemente el motivo del cambio.');
 let datos:DatosCelular;try{datos=validarCelular(crudos);}catch(e){return fallo(e instanceof Error?e.message:'Revisa los datos.');}
 try{await obtenerBaseDatos().query('SELECT public.guardar_celular_acceso($1,$2::uuid,$3::jsonb,$4,$5)',[actor.email,id,JSON.stringify({...datos,...(inicial.length?{custodiaInicial:inicial[0]}:{})}),version,motivo.trim()]);}
 catch(e){const codigo=(e as {code?:string}).code;return fallo(codigo==='P2603'?'Para cambiar la sede registra una devolución y una nueva asignación.':codigo==='P2501'?'La ficha cambió mientras la editabas. Recarga antes de guardar.':codigo==='23505'?'El número vigente, IMEI o inventario ya está registrado. Revisa la ficha existente.':codigo==='42501'?'No tienes permiso para modificar este celular o sede.':codigo==='P2502'?'La sede ya no está disponible.':'No se pudo guardar el celular. Revisa los datos e inténtalo nuevamente.');}
 revalidatePath('/inventario','layout');redirect(destinoConExito(volver??(version===0&&inicial[0]==='en_bodega'?'/inventario/bodega-ti?clase=celular':enlaceCelulares(filtros))));
}
