"use server";
import {destinoConExito} from '@/lib/aviso-exito';
import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {esIdSede} from '@/lib/validacion-sedes';
import {exigirAcceso,exigirAdministrador} from "@/lib/acceso";
import {puedeGestionarDependencias,requiereSede} from "@/lib/politica-acceso";
import {crearSolicitudInsumo,validarSolicitudInsumo,aprobarSolicitudInsumo,entregarSolicitudInsumoConActa,cancelarSolicitudInsumo} from "@/lib/insumos";
import {validarLineasInsumos} from "@/lib/validacion-insumos";
export type EstadoSolicitud={estado:'inicial'|'error'|'guardado';mensaje:string;revision:string;valores:Record<string,string>;errores:Record<string,string>;};
function relanzarRedirect(e:unknown){ if(e && typeof e==='object' && 'digest' in e && String((e as {digest?:unknown}).digest).includes('NEXT_REDIRECT')) throw e; }
export async function guardarSolicitudInsumo(_anterior:EstadoSolicitud,formulario:FormData):Promise<EstadoSolicitud>{
 const actor=await exigirAcceso();const revision=randomUUID();const valores:Record<string,string>={};const errores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoSolicitud=>({estado:'error',mensaje,revision,valores,errores});
 if(!puedeGestionarDependencias(actor.rol)) return fallo('No tienes permiso para crear solicitudes de insumos.');
 const sedeIdVal=formulario.get('sede_id');const sedeId=typeof sedeIdVal==='string'?sedeIdVal:'';
 const lineasRawVal=formulario.get('lineas');const lineasRaw=typeof lineasRawVal==='string'?lineasRawVal:'';
 const datosRawVal=formulario.get('datos');const datosRaw=typeof datosRawVal==='string'?datosRawVal:'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(sedeId))return fallo('Selecciona una sede válida.');
 if(requiereSede(actor.rol) && actor.sedeId && sedeId!==actor.sedeId) return fallo('Solo puedes solicitar insumos para tu sede autorizada.');
 let lineas:{producto_id:string;cantidad:number}[];try{lineas=JSON.parse(lineasRaw);}catch{return fallo('Carrito inválido. Vuelve a armarlo.');}
 let datos:{nombre?:string;run?:string;cargo?:string;telefono?:string;modalidad?:string;motivo?:string}={};
 try{ if(datosRaw) datos=JSON.parse(datosRaw) as typeof datos; }catch{return fallo('Datos del solicitante inválidos.');}
 if(!datos||typeof datos!=='object'||Array.isArray(datos))return fallo('Datos del solicitante inválidos.');
 const solicitud=formulario.get('solicitud');if(typeof solicitud!=='string'||!esIdSede(solicitud)||formulario.getAll('solicitud').length!==1)return fallo('Vuelve a abrir la solicitud.');
 Object.assign(datos,{solicitudId:solicitud});
 try{validarLineasInsumos(lineas);}catch(e){return fallo(e instanceof Error?e.message:'Carrito inválido.');}
 try{const id=await crearSolicitudInsumo(sedeId,actor.email,lineas,datos);revalidatePath('/insumos','layout');redirect(destinoConExito(`/insumos/seguimiento?ver=${id}&guardado=1`));}catch(e){relanzarRedirect(e);return fallo(e instanceof Error?e.message:'No se pudo crear la solicitud.');}
}
export async function validarSolicitudInsumoAccion(_anterior:EstadoSolicitud,formulario:FormData):Promise<EstadoSolicitud>{
 const actor=await exigirAdministrador();const revision=randomUUID();
 const fallo=(mensaje:string):EstadoSolicitud=>({estado:'error',mensaje,revision,valores:{},errores:{}});
 const solicitudVal=formulario.get('solicitud');const solicitud=typeof solicitudVal==='string'?solicitudVal:'';
 const observacion=typeof formulario.get('observacion')==='string'?(formulario.get('observacion') as string).trim():'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(solicitud))return fallo('Solicitud inválida.');
 try{await validarSolicitudInsumo(actor.email,solicitud,observacion);revalidatePath('/insumos','layout');redirect(destinoConExito(`/insumos/seguimiento?ver=${solicitud}&guardado=1`));}catch(e){relanzarRedirect(e);return fallo(e instanceof Error?e.message:'No se pudo validar la solicitud.');}
}
function lineasAprobacionDesdeFormData(f:FormData):{producto_id:string;cantidad_aprobada:number;motivo_reduccion:string}[]{
 const resultado:{producto_id:string;cantidad_aprobada:number;motivo_reduccion:string}[]=[];const vistos=new Set<string>();
 for(const [k,v] of f.entries()){
  if(!k.startsWith('cant_aprobada_'))continue;const id=k.slice('cant_aprobada_'.length);if(vistos.has(id))continue;vistos.add(id);
  if(typeof v!=='string')continue;const cantidad=Number(v);const motivoVal=f.get(`motivo_redu_${id}`);const motivo=typeof motivoVal==='string'?motivoVal.trim():'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))continue;
  if(!Number.isInteger(cantidad)||cantidad<0||cantidad>10000)continue;
  resultado.push({producto_id:id,cantidad_aprobada:cantidad,motivo_reduccion:motivo});
 }
 return resultado;
}
function lineasEntregaDesdeFormData(f:FormData):{producto_id:string;cantidad_entregada:number}[]{
 const resultado:{producto_id:string;cantidad_entregada:number}[]=[];const vistos=new Set<string>();
 for(const [k,v] of f.entries()){
  if(!k.startsWith('cant_entregada_'))continue;const id=k.slice('cant_entregada_'.length);if(vistos.has(id))continue;vistos.add(id);
  if(typeof v!=='string')continue;const cantidad=Number(v);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))continue;
  if(!Number.isInteger(cantidad)||cantidad<1||cantidad>10000)continue;
  resultado.push({producto_id:id,cantidad_entregada:cantidad});
 }
 return resultado;
}
export async function aprobarSolicitudInsumoAccion(_anterior:EstadoSolicitud,formulario:FormData):Promise<EstadoSolicitud>{
 const actor=await exigirAdministrador();const revision=randomUUID();const valores:Record<string,string>={};const errores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoSolicitud=>({estado:'error',mensaje,revision,valores,errores});
 const solicitudVal=formulario.get('solicitud');const solicitud=typeof solicitudVal==='string'?solicitudVal:'';
 const motivoVal=formulario.get('motivo');const motivo=typeof motivoVal==='string'?motivoVal.trim():'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(solicitud))return fallo('Solicitud inválida.');
 const lineas=lineasAprobacionDesdeFormData(formulario);if(!lineas.length)return fallo('Debe incluir al menos un producto aprobado.');
 try{await aprobarSolicitudInsumo(actor.email,solicitud,{lineas,motivo});revalidatePath('/insumos','layout');redirect(destinoConExito(`/insumos/seguimiento?ver=${solicitud}&guardado=1`));}catch(e){relanzarRedirect(e);return fallo(e instanceof Error?e.message:'No se pudo aprobar la solicitud.');}
}
export async function entregarSolicitudInsumoAccion(_anterior:EstadoSolicitud,formulario:FormData):Promise<EstadoSolicitud>{
 await exigirAdministrador();const revision=randomUUID();const valores:Record<string,string>={};const errores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoSolicitud=>({estado:'error',mensaje,revision,valores,errores});
 const solicitudVal=formulario.get('solicitud');const solicitud=typeof solicitudVal==='string'?solicitudVal:'';
 const receptor=typeof formulario.get('receptor')==='string'?(formulario.get('receptor') as string).trim():'';
 const responsable_ti=typeof formulario.get('responsable_ti')==='string'?(formulario.get('responsable_ti') as string).trim():'';
 const fecha_entrega=typeof formulario.get('fecha_entrega')==='string'?(formulario.get('fecha_entrega') as string).trim():'';
 const observaciones=typeof formulario.get('observaciones')==='string'?(formulario.get('observaciones') as string).trim():'';
 const recibeRun=typeof formulario.get('recibeRun')==='string'?(formulario.get('recibeRun') as string).trim():'';
 const recibeCargo=typeof formulario.get('recibeCargo')==='string'?(formulario.get('recibeCargo') as string).trim():'';
 const entregaCargo=typeof formulario.get('entregaCargo')==='string'?(formulario.get('entregaCargo') as string).trim():'UTIC';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(solicitud))return fallo('Solicitud inválida.');
 if(!receptor)return fallo('Indica quién recibe.');
 if(!responsable_ti)return fallo('Indica el responsable de TI.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)||!Number.isFinite(Date.parse(fecha_entrega)))return fallo('Fecha de entrega inválida.');
 const lineas=lineasEntregaDesdeFormData(formulario);if(!lineas.length)return fallo('Debe incluir al menos un producto entregado.');
 try{
  const res=await entregarSolicitudInsumoConActa(solicitud,{receptor,responsable_ti,fecha_entrega,observaciones,recibeRun,recibeCargo,entregaCargo,lineas});
  revalidatePath('/insumos','layout');revalidatePath('/inventario/actas','layout');
  redirect(destinoConExito(`/inventario/actas/${res.actaId}`));
 }catch(e){relanzarRedirect(e);return fallo(e instanceof Error?e.message:'No se pudo entregar la solicitud ni generar el acta.');}
}
export async function cancelarSolicitudInsumoAccion(_anterior:EstadoSolicitud,formulario:FormData):Promise<EstadoSolicitud>{
 const actor=await exigirAdministrador();const revision=randomUUID();const valores:Record<string,string>={};const errores:Record<string,string>={};
 const fallo=(mensaje:string):EstadoSolicitud=>({estado:'error',mensaje,revision,valores,errores});
 const solicitudVal=formulario.get('solicitud');const solicitud=typeof solicitudVal==='string'?solicitudVal:'';
 const motivoVal=formulario.get('motivo');const motivo=typeof motivoVal==='string'?motivoVal.trim():'';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(solicitud))return fallo('Solicitud inválida.');
 if(!motivo)return fallo('Indica el motivo de la cancelación.');
 try{await cancelarSolicitudInsumo(actor.email,solicitud,motivo);revalidatePath('/insumos','layout');redirect(destinoConExito(`/insumos/historial?ver=${solicitud}&guardado=1`));}catch(e){relanzarRedirect(e);return fallo(e instanceof Error?e.message:'No se pudo cancelar la solicitud.');}
}
