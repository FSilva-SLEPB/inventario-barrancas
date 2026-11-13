import 'server-only';import {exigirAcceso} from '@/lib/acceso';import {obtenerBaseDatos} from '@/lib/db';
export type ContactoCelular={id:string;sede_id:string;telefono:string;uso_contacto:string;acta_id:string|null};
export async function contactosCelulares(sedes:string[],uso:'establecimiento'|'director'='establecimiento'):Promise<Record<string,ContactoCelular[]>>{
 const actor=await exigirAcceso();if(!sedes.length)return {};const filas=(await obtenerBaseDatos().query<{r:ContactoCelular[]}>('SELECT public.contactos_celulares_sedes($1,$2::uuid[],$3) r',[actor.email,sedes,uso])).rows[0].r;const salida:Record<string,ContactoCelular[]>={};for(const f of filas)(salida[f.sede_id]??=[]).push(f);return salida;
}
