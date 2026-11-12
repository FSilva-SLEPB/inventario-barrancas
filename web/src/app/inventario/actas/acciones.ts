'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigirPermiso,exigirAlguno} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {retornoDocumento,enlaceDocumentoConRetorno} from '@/lib/navegacion-actas';
import {CAMPOS_ACTA,metadatosActa,destinatariosActa} from '@/lib/validacion-actas';
import {emitirActa,obtenerActa,fuenteActaEntrega,ESTADOS_ENVIO} from '@/lib/actas';
import {configuracionCorreoActas,enviarPdfActa,validarDestinosCorreoActas} from '@/lib/correo-actas';
import {destinoConExito} from '@/lib/aviso-exito';
export type EstadoActa={estado:'inicial'|'error'|'resultado';mensaje:string;revision:string;valores:Record<string,string>};
function retornoFormulario(f:FormData){const v=f.get('volver');if(f.getAll('volver').length>1||v!==null&&(typeof v!=='string'||v!==''&&!retornoDocumento(v)))throw new Error('Regreso al inventario inválido.');return typeof v==='string'&&v?retornoDocumento(v):null;}
export async function guardarActa(_previo:EstadoActa,f:FormData):Promise<EstadoActa>{
 await exigirPermiso('actas','registrar');const revision=randomUUID(),valores:Record<string,string>={};for(const k of Object.keys(CAMPOS_ACTA)){const x=f.get(k);valores[k]=typeof x==='string'?x.slice(0,2500):'';}
 const error=(mensaje:string):EstadoActa=>({estado:'error',mensaje,revision,valores});const historica=f.has('entrega'),fuente=historica?'entrega':'movimiento',permitidos=['solicitud',fuente,...Object.keys(CAMPOS_ACTA)],id=f.get('solicitud'),mov=f.get(fuente);
 if(permitidos.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!permitidos.includes(k)&&k!=='volver'&&!k.startsWith('$ACTION'))||typeof id!=='string'||!esIdSede(id)||typeof mov!=='string'||!esIdSede(mov))return error('Formulario inválido. Vuelve a abrir el acta.');
 let retorno:string|null;try{retorno=retornoFormulario(f);}catch{return error('El regreso al inventario no es válido.');}
 try{const original=historica?await fuenteActaEntrega(mov):null;await emitirActa(id,mov,metadatosActa(valores,historica,original?.correo),historica);}catch(e){const code=(e as {code?:string}).code;return error(code==='P2701'?'Ya existe un acta para este registro o cambió la solicitud. Vuelve al listado.':code==='P2702'?'El registro ya no está disponible.':e instanceof Error&&!code&&e.message.startsWith('Indica')?e.message:'No se pudo emitir el acta. Revisa los datos; no se guardaron cambios parciales.');}
 revalidatePath('/inventario/actas');revalidatePath('/inventario/movimientos');redirect(destinoConExito(retorno?enlaceDocumentoConRetorno(retorno,id):'/inventario/actas/'+id,'acta'));
}
export async function enviarActa(_previo:EstadoActa,f:FormData):Promise<EstadoActa>{
 const actor=await exigirAlguno('actas.enviar','actas_insumos.enviar'),revision=randomUUID(),raw=f.get('destinatarios'),valores={destinatarios:typeof raw==='string'?raw.slice(0,1500):''},fallo=(mensaje:string):EstadoActa=>({estado:'error',mensaje,revision,valores});
 const id=f.get('acta'),solicitud=f.get('solicitud'),revisado=f.get('revisado');const campos=['acta','solicitud','destinatarios'];if(campos.some(k=>f.getAll(k).length!==1)||f.getAll('revisado').length>1||[...f.keys()].some(k=>!campos.includes(k)&&k!=='revisado'&&k!=='volver'&&!k.startsWith('$ACTION'))||typeof id!=='string'||!esIdSede(id)||typeof solicitud!=='string'||!esIdSede(solicitud)||typeof raw!=='string'||raw.length>1500||(revisado!==null&&revisado!=='si'))return fallo('Formulario inválido. Vuelve a abrir el envío.');
 let retorno:string|null;try{retorno=retornoFormulario(f);}catch{return fallo('El regreso al inventario no es válido.');}
 let destinos:string[],config:ReturnType<typeof configuracionCorreoActas>;try{destinos=destinatariosActa(raw);config=configuracionCorreoActas();destinos=validarDestinosCorreoActas(config,destinos);}catch(e){return fallo(e instanceof Error?e.message:'Revisa los destinatarios.');}
 const acta=await obtenerActa(id,true);if(!acta?.pdf)return fallo('El acta no está disponible.');
 try{const r=(await obtenerBaseDatos().query<{r:{repetida:boolean;token?:string;estado:string}}>('SELECT public.iniciar_envio_acta_acceso($1,$2,$3,$4::text[],$5,$6) AS r',[actor.email,solicitud,id,destinos,config.remitente,revisado==='si'])).rows[0].r;
 if(r.repetida){revalidatePath('/inventario/actas/'+id);return {estado:'resultado',mensaje:'Esta solicitud ya fue procesada: '+(ESTADOS_ENVIO[r.estado]??r.estado)+'. No se repitió el envío.',revision,valores};}
 const resultado=await enviarPdfActa(config,solicitud,destinos,acta.datos,acta.pdf);await obtenerBaseDatos().query('SELECT public.terminar_envio_acta_acceso($1,$2,$3,$4::jsonb)',[solicitud,r.token,resultado.estado,JSON.stringify(resultado.resultado)]);revalidatePath('/inventario/actas/'+id);if(resultado.estado!=='aceptado')return fallo(ESTADOS_ENVIO[resultado.estado]+'. Revisa el historial antes de volver a enviar.');
 }catch(e){const c=(e as {code?:string}).code,m:Record<string,string>={P2701:'La solicitud ya fue utilizada. Vuelve a abrir el envío.',P2702:'El acta no está disponible.',P2703:'Ya hay un envío en curso. Espera su resultado.',P2704:'Hay un resultado por confirmar. Revisa el envío anterior y marca la comprobación antes de reenviar.',P2705:'Se alcanzó el límite de envíos recientes de esta acta. Espera unos minutos.'};return fallo(m[c??'']??'No se pudo confirmar el resultado del envío. Revisa el historial antes de reenviar.');}
 redirect(destinoConExito(retorno?enlaceDocumentoConRetorno(retorno,id):'/inventario/actas/'+id,'correo'));
}
