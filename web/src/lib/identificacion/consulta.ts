import 'server-only';
import {obtenerBaseDatos} from '@/lib/db';
import type {BienIdentificacion} from './reglas';
export type ConfigNumero={id:string;nombre:string;prefijo:string|null;activo:boolean|null;version:number};
export type HistorialEtiqueta={id:string;estado:string;registrado_en:string;cantidad:number};
export async function consultarIdentificacion(actor:string,filtros:Record<string,string|number>,recurso:'numeracion'|'etiquetas'){
 return (await obtenerBaseDatos().query<{r:{total:number;filas:BienIdentificacion[]}}>('SELECT public.consultar_identificacion($1,$2::jsonb,$3) r',[actor,JSON.stringify(filtros),recurso])).rows[0].r;
}
