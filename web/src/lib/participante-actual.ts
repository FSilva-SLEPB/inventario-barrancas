import 'server-only';
import {exigirAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
export type ParticipanteActual={nombre:string;run:string;cargo:string;correo:string;telefono:string};
/** Solo la cuenta autenticada: no toma otra identidad desde parámetros del navegador. */
export async function obtenerParticipanteActual():Promise<ParticipanteActual>{
 const actor=await exigirAcceso('insumos');
 const {rows}=await obtenerBaseDatos().query<{nombre:string;run:string;cargo:string}>(`SELECT COALESCE(NULLIF(f.nombre,''),u.nombre,'') AS nombre,COALESCE(f.rut,'') AS run,COALESCE(NULLIF(f.cargo,''),NULLIF(f.unidad,''),'') AS cargo FROM public.usuarios_acceso u LEFT JOIN public.funcionarios_nc f ON f.correo=u.correo AND f.activo WHERE u.correo=$1 AND u.activo`,[actor.email]);
 return {nombre:rows[0]?.nombre??'',run:rows[0]?.run??'',cargo:rows[0]?.cargo??'',correo:actor.email,telefono:''};
}
