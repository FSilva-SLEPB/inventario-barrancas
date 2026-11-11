'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {esIdSede} from '@/lib/validacion-sedes';
import {guardarProductoInsumo,registrarCompraInsumo} from '@/lib/insumos';
export type EstadoProducto={estado:'inicial'|'error'|'ok';mensaje:string;revision:string;valores:Record<string,string>};
const mensajeError=(e:unknown)=>{const c=(e as {code?:string})?.code;return c==='23505'?'Ya existe un producto con ese código.':c==='P3101'?'El producto cambió o la solicitud ya se utilizó. Recarga antes de continuar.':'No se pudo guardar. Revisa los datos y conserva esta ventana para corregirlos.';};
export async function guardarProductoAccion(_anterior:EstadoProducto,f:FormData):Promise<EstadoProducto>{
 await exigirAdministrador();const revision=randomUUID(),valores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoProducto=>({estado:'error',mensaje,revision,valores});
 for(const k of ['id','codigo','nombre','categoria','unidad','activo','version','solicitud']){const v=f.get(k);if(f.getAll(k).length!==1||typeof v!=='string')return fallo('Formulario inválido.');valores[k]=v.normalize('NFC').trim();}
 if(!esIdSede(valores.solicitud)||!esIdSede(valores.id)||!['true','false'].includes(valores.activo)||!/^\d{1,10}$/.test(valores.version))return fallo('Formulario inválido.');
 for(const[k,max]of [['codigo',60],['nombre',200],['categoria',120],['unidad',60]] as const)if(!valores[k]||valores[k].length>max||/\p{Cc}/u.test(valores[k]))return fallo('Completa los datos del producto dentro de sus límites.');
 try{await guardarProductoInsumo({...(valores.id?{id:valores.id}:{}),codigo:valores.codigo,nombre:valores.nombre,categoria:valores.categoria,unidad:valores.unidad,activo:valores.activo==='true',version:Number(valores.version)},valores.solicitud);
  revalidatePath('/mantenedores/insumos');revalidatePath('/insumos','layout');return {estado:'ok',mensaje:valores.id?'Producto actualizado.':'Producto creado.',revision,valores};
 }catch(e){return fallo(mensajeError(e));}
}
export async function registrarCompraAccion(_anterior:EstadoProducto,f:FormData):Promise<EstadoProducto>{
 await exigirAdministrador();const revision=randomUUID(),valores:Record<string,string>={};const fallo=(mensaje:string):EstadoProducto=>({estado:'error',mensaje,revision,valores});
 const campos=['solicitud','productoId','version','nombre','categoria','unidad','cantidad','oc','fechaCompra'];
 if([...f.keys()].some(k=>!campos.includes(k)&&!k.startsWith('$ACTION')))return fallo('Formulario inválido.');
 for(const k of campos){const raw=f.get(k);if(f.getAll(k).length!==1||typeof raw!=='string')return fallo('Formulario inválido.');valores[k]=raw.normalize('NFC').trim();}
 if(!esIdSede(valores.solicitud)||valores.productoId&&!esIdSede(valores.productoId)||!/^\d{1,10}$/.test(valores.version)||Number(valores.version)>=2147483647||!/^\d{1,6}$/.test(valores.cantidad)||Number(valores.cantidad)<1||Number(valores.cantidad)>100000)return fallo('Indica una cantidad entera válida y vuelve a abrir el ingreso si el producto cambió.');
 for(const[k,max]of [['nombre',200],['categoria',120],['unidad',60],['oc',120]] as const)if(!valores[k]||valores[k].length>max||/\p{Cc}/u.test(valores[k]))return fallo('Completa producto, categoría, unidad y OC dentro de sus límites.');
 const fecha=/^\d{4}-\d{2}-\d{2}$/.test(valores.fechaCompra)?new Date(valores.fechaCompra+'T00:00:00Z'):null;
 if(!fecha||!Number.isFinite(fecha.getTime())||fecha.toISOString().slice(0,10)!==valores.fechaCompra)return fallo('Indica una fecha de compra válida.');
 try{const r=await registrarCompraInsumo(valores.solicitud,{productoId:valores.productoId,version:Number(valores.version),nombre:valores.nombre,categoria:valores.categoria,unidad:valores.unidad,cantidad:Number(valores.cantidad),oc:valores.oc,fechaCompra:valores.fechaCompra});revalidatePath('/mantenedores/insumos');revalidatePath('/insumos','layout');return {estado:'ok',mensaje:'Ingreso registrado para '+r.codigo+'.',revision,valores};}
 catch(e){const c=(e as {code?:string})?.code;return fallo(c==='P3302'?'Hay productos anteriores coincidentes. Selecciona el producto del catálogo.':c==='P3301'?'Esta solicitud ya se utilizó con otros datos. Cierra y vuelve a abrir el ingreso.':c==='P3102'?'El producto no está activo. Revisa su ficha.':c==='22023'||c==='22007'||c==='22008'?'Revisa los datos y la fecha de compra; no puede ser futura.':mensajeError(e));}
}
