'use server';
import {exigirPermiso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {revalidatePath} from 'next/cache';
import {ESTADOS_ADMINISTRATIVOS_ACTIVO,ESTADOS_CONDICION_ACTIVO} from '@/lib/estados-activo';
export async function guardarEstadosInventario(solicitud:string,datos:{clase:'equipo'|'celular';id:string;version:number;administrativo:string;condicion:string}){
 const actor=await exigirPermiso('bajas','confirmar');
 if(!esIdSede(solicitud)||!datos||!esIdSede(datos.id)||!['equipo','celular'].includes(datos.clase)||!Number.isInteger(datos.version)||datos.version<1||datos.version>=2147483647||!Object.hasOwn(ESTADOS_ADMINISTRATIVOS_ACTIVO,datos.administrativo)||(datos.administrativo==='activo'&&datos.condicion!==''&&!Object.hasOwn(ESTADOS_CONDICION_ACTIVO,datos.condicion)))return {ok:false as const,mensaje:'Revisa los estados antes de guardar.'};
 try{
  const {rows}=await obtenerBaseDatos().query<{r:{version:number;fechaBaja:string|null}}>('SELECT public.guardar_estados_activo_acceso($1,$2::uuid,$3::jsonb) AS r',[actor.email,solicitud,JSON.stringify(datos)]);
  revalidatePath('/inventario','layout');return {ok:true as const,...rows[0].r};
 }catch(e){
  const codigo=(e as {code?:string}).code;return {ok:false as const,mensaje:codigo==='P3001'?'El bien cambió. Cierra y vuelve a abrir el registro antes de guardar.':codigo==='P3002'?'El registro está dado de baja y es de solo lectura.':codigo==='P2802'?'Devuelve el préstamo antes de cambiar los estados.':codigo==='P3004'?'Resuelve el incidente abierto antes de volver a Activo.':codigo==='42501'?'No tienes permiso para cambiar estos estados.':'No se pudo guardar el estado. Se conserva el registro anterior.'};
 }
}
