"use server";
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {exigirAdministrador} from "@/lib/acceso";
import {guardarProductoInsumo,ingresarStockInsumo} from "@/lib/insumos";

export type EstadoProducto={estado:'inicial'|'error'|'ok';mensaje:string;revision:string;valores:Record<string,string>};

function norm(v:FormDataEntryValue|null,max:number){return typeof v==='string'?v.normalize('NFC').trim().replace(/\s+/g,' ').slice(0,max):'';}

export async function guardarProductoAccion(_anterior:EstadoProducto,formulario:FormData):Promise<EstadoProducto>{
 const rev=randomUUID();
 try{
  await exigirAdministrador();
  const id=norm(formulario.get('id'),36);
  const codigo=norm(formulario.get('codigo'),60);
  const nombre=norm(formulario.get('nombre'),200);
  const categoria=norm(formulario.get('categoria'),120);
  const unidad=norm(formulario.get('unidad'),60);
  const activo=formulario.get('activo')!=='false';
  const valores={id,codigo,nombre,categoria,unidad,activo:String(activo)};
  if(!codigo||!nombre||!categoria||!unidad) return {estado:'error',mensaje:'Completa código, nombre, categoría y unidad.',revision:rev,valores};
  await guardarProductoInsumo({id:id||undefined,codigo,nombre,categoria,unidad,activo});
  revalidatePath('/mantenedores/insumos');
  revalidatePath('/insumos','layout');
  return {estado:'ok',mensaje:id?'Producto actualizado.':'Producto creado.',revision:rev,valores:{codigo:'',nombre:'',categoria:'',unidad:'',activo:'true',id:''}};
 }catch(e){
  const msg=e instanceof Error?e.message:'No se pudo guardar el producto.';
  return {estado:'error',mensaje:/duplicate key|23505/i.test(msg)?'Ya existe un producto con ese código.':msg,revision:rev,valores:{}};
 }
}

export type EstadoStock={estado:'inicial'|'error'|'ok';mensaje:string;revision:string};
export async function ingresarStockAccion(_anterior:EstadoStock,formulario:FormData):Promise<EstadoStock>{
 const rev=randomUUID();
 try{
  await exigirAdministrador();
  const productoId=norm(formulario.get('producto_id'),36);
  const cantidad=Number(formulario.get('cantidad'));
  if(!productoId) return {estado:'error',mensaje:'Producto inválido.',revision:rev};
  if(!Number.isFinite(cantidad)) return {estado:'error',mensaje:'Cantidad inválida.',revision:rev};
  await ingresarStockInsumo(productoId,Math.trunc(cantidad));
  revalidatePath('/mantenedores/insumos');
  revalidatePath('/insumos','layout');
  return {estado:'ok',mensaje:'Stock ingresado correctamente.',revision:rev};
 }catch(e){
  return {estado:'error',mensaje:e instanceof Error?e.message:'No se pudo ingresar stock.',revision:rev};
 }
}
