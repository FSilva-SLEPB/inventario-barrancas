import 'server-only';
import {exigirAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {puedeVerFotoSede} from '@/lib/politica-fotos-sedes';
export type FotoSede={id:string;version:number};
export async function obtenerFotoSede(sede:string):Promise<FotoSede|null>{
 const actor=await exigirAcceso();if(!puedeVerFotoSede(actor.rol,actor.sedeId,sede))return null;
 return(await obtenerBaseDatos().query<FotoSede>('SELECT id,version FROM public.fotografias_sedes WHERE sede_id=$1 ORDER BY version DESC LIMIT 1',[sede])).rows[0]??null;
}
