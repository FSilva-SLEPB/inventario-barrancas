'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {validarMovimiento,retornoMovimiento} from '@/lib/validacion-movimientos-inventario';
import {destinoConExito} from '@/lib/aviso-exito';
export type EstadoMovimiento={estado:'inicial'|'error';mensaje:string;valores:Record<string,string>;revision?:string};
export async function registrarMovimiento(_anterior:EstadoMovimiento,f:FormData):Promise<EstadoMovimiento>{
 const actor=await exigirAdministrador(),valores:Record<string,string>={};for(const k of ['destino','fecha','receptor','motivo']){const v=f.get(k);valores[k]=typeof v==='string'?v.slice(0,2000):'';}
 let preparado:ReturnType<typeof validarMovimiento>;try{preparado=validarMovimiento(f);if(!retornoMovimiento(preparado.volver))throw new Error('El regreso a la consulta no es válido.');}catch(e){return {estado:'error',revision:randomUUID(),mensaje:e instanceof Error?e.message:'Revisa el movimiento.',valores};}
 try{await obtenerBaseDatos().query('SELECT public.mover_bien_acceso($1,$2::uuid,$3::jsonb)',[actor.email,preparado.solicitud,JSON.stringify(preparado.datos)]);}catch(e){const c=(e as {code?:string}).code,m:Record<string,string>={P2601:'El bien cambió o la solicitud ya fue utilizada. Recarga la ficha antes de confirmar.',P2602:'El estado del bien no permite este movimiento. Solo se asigna desde Bodega TI y solo se devuelve un bien asignado.',P2604:'El bien o la sede ya no están disponibles.',P2605:'El equipo tiene un incidente de robo abierto. Revisa su recuperación antes de moverlo.',"42501":'Solo UTIC puede confirmar movimientos.',"22023":'Revisa los datos y la fecha: no puede ser anterior al último movimiento.'};return {estado:'error',revision:randomUUID(),mensaje:m[c??'']??'No se pudo registrar el movimiento. No se guardaron cambios parciales.',valores};}
 revalidatePath('/inventario','layout');redirect(destinoConExito(retornoMovimiento(preparado.volver)!,preparado.datos.accion==='devolucion'?'devolucion':'asignacion'));
}
