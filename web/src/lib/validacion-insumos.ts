import {esIdSede} from '@/lib/validacion-sedes';
export type EstadoSolicitudInsumo='solicitada'|'en_validacion'|'aprobada'|'entregada'|'cancelada';
export const ESTADOS_SOLICITUD_INSUMO:Record<EstadoSolicitudInsumo,string>={solicitada:'Solicitada',en_validacion:'En validación (TI)',aprobada:'Aprobada · reservada',entregada:'Entregada (contra entrega)',cancelada:'Cancelada'};
export type LineaSolicitudValidada={producto_id:string;cantidad_solicitada:number;};
export function validarLineasInsumos(lineas:unknown[]):LineaSolicitudValidada[]{
 if(!Array.isArray(lineas)||!lineas.length)throw new Error('Debe incluir al menos un producto en el carrito.');
 const resultado:LineaSolicitudValidada[]=[];const vistos=new Set<string>();
 for(const l of lineas){
  const x=l as Record<string,unknown>;const pid=typeof x.producto_id==='string'?x.producto_id:'';
  const cant=typeof x.cantidad==='number'?x.cantidad:typeof x.cantidad==='string'?Number(x.cantidad):NaN;
  if(!esIdSede(pid))throw new Error('Producto inválido en el carrito.');
  if(!Number.isFinite(cant)||cant<1||cant>10000)throw new Error('Cantidad inválida para un producto.');
  if(vistos.has(pid))throw new Error('Producto repetido en el carrito.');
  vistos.add(pid);resultado.push({producto_id:pid,cantidad_solicitada:cant});
 }
 return resultado;
}
export type DatosAprobacionInsumo={lineas:{producto_id:string;cantidad_aprobada:number;motivo_reduccion:string}[];motivo:string;};
export function validarAprobacionInsumos(formulario:FormData):DatosAprobacionInsumo{
 const lineasRaw=formulario.get('lineas');const motivoRaw=formulario.get('motivo');
 if(typeof lineasRaw!=='string')throw new Error('Faltan las líneas de aprobación.');
 let lineas:{producto_id:string;cantidad_aprobada:number;motivo_reduccion:string}[];try{lineas=JSON.parse(lineasRaw);}catch{throw new Error('Líneas de aprobación inválidas.');}
 if(!Array.isArray(lineas)||!lineas.length)throw new Error('Debe incluir al menos un producto aprobado.');
 const motivo=typeof motivoRaw==='string'?motivoRaw.trim():'';
 for(const l of lineas){
  const pid=typeof l.producto_id==='string'?l.producto_id:'';
  const cant=typeof l.cantidad_aprobada==='number'?l.cantidad_aprobada:Number(l.cantidad_aprobada);
  if(!esIdSede(pid))throw new Error('Producto inválido en la aprobación.');
  if(!Number.isFinite(cant)||cant<0||cant>10000)throw new Error('Cantidad aprobada inválida.');
 }
 return {lineas,motivo};
}
export type DatosEntregaInsumo={receptor:string;responsable_ti:string;fecha_entrega:string;observaciones:string;lineas:{producto_id:string;cantidad_entregada:number}[];acta_id:string|null;};
export function validarEntregaInsumos(formulario:FormData):DatosEntregaInsumo{
 const receptorVal=formulario.get('receptor');const receptor=typeof receptorVal==='string'?receptorVal.trim():'';
 const responsableTiVal=formulario.get('responsable_ti');const responsable_ti=typeof responsableTiVal==='string'?responsableTiVal.trim():'';
 const fechaEntregaVal=formulario.get('fecha_entrega');const fecha_entrega=typeof fechaEntregaVal==='string'?fechaEntregaVal.trim():'';
 const observacionesVal=formulario.get('observaciones');const observaciones=typeof observacionesVal==='string'?observacionesVal.trim():'';
 const lineasRawVal=formulario.get('lineas');const lineasRaw=typeof lineasRawVal==='string'?lineasRawVal:'';
 const actaRaw=formulario.get('acta_id');
 if(!receptor)throw new Error('Indica quién recibe.');
 if(!responsable_ti)throw new Error('Indica el responsable de TI.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)||!Number.isFinite(Date.parse(fecha_entrega)))throw new Error('Fecha de entrega inválida.');
 let lineas:{producto_id:string;cantidad_entregada:number}[];try{lineas=JSON.parse(lineasRaw);}catch{throw new Error('Líneas de entrega inválidas.');}
 if(!Array.isArray(lineas)||!lineas.length)throw new Error('Debe incluir al menos un producto entregado.');
 for(const l of lineas){
  const pid=typeof l.producto_id==='string'?l.producto_id:'';
  const cant=typeof l.cantidad_entregada==='number'?l.cantidad_entregada:Number(l.cantidad_entregada);
  if(!esIdSede(pid))throw new Error('Producto inválido en la entrega.');
  if(!Number.isFinite(cant)||cant<1||cant>10000)throw new Error('Cantidad entregada inválida.');
 }
 const acta_id=typeof actaRaw==='string'&&esIdSede(actaRaw)?actaRaw:null;
 return {receptor,responsable_ti,fecha_entrega,observaciones,lineas,acta_id};
}
