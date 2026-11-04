'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {CAMPOS_ACTA,metadatosActa,destinatariosActa} from '@/lib/validacion-actas';
import {emitirActa,obtenerActa,ESTADOS_ENVIO} from '@/lib/actas';
import {configuracionCorreoActas,enviarPdfActa} from '@/lib/correo-actas';
import {destinoConExito} from '@/lib/aviso-exito';
export type EstadoActa={estado:'inicial'|'error'|'resultado';mensaje:string;revision:string;valores:Record<string,string>};
export async function guardarActa(_previo:EstadoActa,f:FormData):Promise<EstadoActa>{
 await exigirAdministrador();const revision=randomUUID(),valores:Record<string,string>={};for(const k of Object.keys(CAMPOS_ACTA)){const x=f.get(k);valores[k]=typeof x==='string'?x.slice(0,2500):'';}
 const error=(mensaje:string):EstadoActa=>({estado:'error',mensaje,revision,valores});const permitidos=['solicitud','movimiento',...Object.keys(CAMPOS_ACTA)],id=f.get('solicitud'),mov=f.get('movimiento');
 if(permitidos.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!permitidos.includes(k)&&!k.startsWith('$ACTION'))||typeof id!=='string'||!esIdSede(id)||typeof mov!=='string'||!esIdSede(mov))return error('Formulario inválido. Vuelve a abrir el acta.');
 try{await emitirActa(id,mov,metadatosActa(valores));}catch(e){const code=(e as {code?:string}).code;return error(code==='P2701'?'Ya existe un acta para este movimiento o cambió la solicitud. Vuelve al listado.':code==='P2702'?'El movimiento ya no está disponible.':e instanceof Error&&!code&&e.message.startsWith('Indica')?e.message:'No se pudo emitir el acta. Revisa los datos; no se guardaron cambios parciales.');}
 revalidatePath('/inventario/actas');redirect(destinoConExito('/inventario/actas/'+id,'acta'));
}
export async function enviarActa(_previo:EstadoActa,f:FormData):Promise<EstadoActa>{
 const actor=await exigirAdministrador(),revision=randomUUID(),raw=f.get('destinatarios'),valores={destinatarios:typeof raw==='string'?raw.slice(0,1500):''},fallo=(mensaje:string):EstadoActa=>({estado:'error',mensaje,revision,valores});
 const id=f.get('acta'),solicitud=f.get('solicitud'),revisado=f.get('revisado');const campos=['acta','solicitud','destinatarios'];if(campos.some(k=>f.getAll(k).length!==1)||f.getAll('revisado').length>1||[...f.keys()].some(k=>!campos.includes(k)&&k!=='revisado'&&!k.startsWith('$ACTION'))||typeof id!=='string'||!esIdSede(id)||typeof solicitud!=='string'||!esIdSede(solicitud)||typeof raw!=='string'||raw.length>1500||(revisado!==null&&revisado!=='si'))return fallo('Formulario inválido. Vuelve a abrir el envío.');
 let destinos:string[],config:ReturnType<typeof configuracionCorreoActas>;try{destinos=destinatariosActa(raw);config=configuracionCorreoActas();}catch(e){return fallo(e instanceof Error?e.message:'Revisa los destinatarios.');}
 const acta=await obtenerActa(id,true);if(!acta?.pdf)return fallo('El acta no está disponible.');
 try{const r=(await obtenerBaseDatos().query<{r:{repetida:boolean;token?:string;estado:string}}>('SELECT public.iniciar_envio_acta_acceso($1,$2,$3,$4::text[],$5,$6) AS r',[actor.email,solicitud,id,destinos,config.remitente,revisado==='si'])).rows[0].r;
 if(r.repetida){revalidatePath('/inventario/actas/'+id);return {estado:'resultado',mensaje:'Esta solicitud ya fue procesada: '+(ESTADOS_ENVIO[r.estado]??r.estado)+'. No se repitió el envío.',revision,valores};}
 const resultado=await enviarPdfActa(config,solicitud,destinos,acta.datos,acta.pdf);await obtenerBaseDatos().query('SELECT public.terminar_envio_acta_acceso($1,$2,$3,$4::jsonb)',[solicitud,r.token,resultado.estado,JSON.stringify(resultado.resultado)]);revalidatePath('/inventario/actas/'+id);if(resultado.estado!=='aceptado')return fallo(ESTADOS_ENVIO[resultado.estado]+'. Revisa el historial antes de volver a enviar.');
 }catch(e){const c=(e as {code?:string}).code,m:Record<string,string>={P2701:'La solicitud ya fue utilizada. Vuelve a abrir el envío.',P2702:'El acta no está disponible.',P2703:'Ya hay un envío en curso. Espera su resultado.',P2704:'Hay un resultado por confirmar. Revisa el envío anterior y marca la comprobación antes de reenviar.',P2705:'Se alcanzó el límite de envíos recientes de esta acta. Espera unos minutos.'};return fallo(m[c??'']??'No se pudo confirmar el resultado del envío. Revisa el historial antes de reenviar.');}
 redirect(destinoConExito('/inventario/actas/'+id,'correo'));
}
