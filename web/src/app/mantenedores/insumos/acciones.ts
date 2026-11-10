'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {esIdSede} from '@/lib/validacion-sedes';
import {guardarProductoInsumo,ingresarStockInsumo} from '@/lib/insumos';
export type EstadoProducto={estado:'inicial'|'error'|'ok';mensaje:string;revision:string;valores:Record<string,string>};
export type EstadoStock={estado:'inicial'|'error'|'ok';mensaje:string;revision:string};
const mensajeError=(e:unknown)=>{const c=(e as {code?:string})?.code;return c==='23505'?'Ya existe un producto con ese código.':c==='P3101'?'El producto cambió o la solicitud ya se utilizó. Recarga antes de continuar.':'No se pudo guardar. Revisa los datos y conserva esta ventana para corregirlos.';};
export async function guardarProductoAccion(_anterior:EstadoProducto,f:FormData):Promise<EstadoProducto>{
 await exigirAdministrador();const revision=randomUUID(),valores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoProducto=>({estado:'error',mensaje,revision,valores});
 for(const k of ['id','codigo','nombre','categoria','unidad','activo','version','solicitud']){const v=f.get(k);if(f.getAll(k).length!==1||typeof v!=='string')return fallo('Formulario inválido.');valores[k]=v.normalize('NFC').trim();}
 if(!esIdSede(valores.solicitud)||valores.id&&!esIdSede(valores.id)||!['true','false'].includes(valores.activo)||!/^\d{1,10}$/.test(valores.version))return fallo('Formulario inválido.');
 for(const[k,max]of [['codigo',60],['nombre',200],['categoria',120],['unidad',60]] as const)if(!valores[k]||valores[k].length>max||/\p{Cc}/u.test(valores[k]))return fallo('Completa los datos del producto dentro de sus límites.');
 try{await guardarProductoInsumo({...(valores.id?{id:valores.id}:{}),codigo:valores.codigo,nombre:valores.nombre,categoria:valores.categoria,unidad:valores.unidad,activo:valores.activo==='true',version:Number(valores.version)},valores.solicitud);
  revalidatePath('/mantenedores/insumos');revalidatePath('/insumos','layout');return {estado:'ok',mensaje:valores.id?'Producto actualizado.':'Producto creado.',revision,valores};
 }catch(e){return fallo(mensajeError(e));}
}
export async function ingresarStockAccion(_anterior:EstadoStock,f:FormData):Promise<EstadoStock>{
 await exigirAdministrador();const revision=randomUUID(),fallo=(mensaje:string):EstadoStock=>({estado:'error',mensaje,revision});
 const id=f.get('producto_id'),cantidad=f.get('cantidad'),solicitud=f.get('solicitud');
 if(typeof id!=='string'||typeof solicitud!=='string'||!esIdSede(id)||!esIdSede(solicitud)||typeof cantidad!=='string'||!Number.isInteger(Number(cantidad))||Number(cantidad)<1||Number(cantidad)>100000||['producto_id','cantidad','solicitud'].some(k=>f.getAll(k).length!==1))return fallo('Indica un producto y una cantidad entera válida.');
 try{await ingresarStockInsumo(id as string,Number(cantidad),solicitud as string);revalidatePath('/mantenedores/insumos');revalidatePath('/insumos','layout');return {estado:'ok',mensaje:'Stock ingresado correctamente.',revision};}catch(e){return fallo(mensajeError(e));}
}
