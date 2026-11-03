import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {SECCIONES_DIRECTORIO,type SeccionDirectorio} from '@/lib/secciones-directorio';
import type {BusquedaDirectorio} from '@/components/vista-directorio';
export default async function DirectorioAnterior({seccion,searchParams}:{seccion:SeccionDirectorio;searchParams:Promise<BusquedaDirectorio>}){
 await exigirAdministrador();const p=await searchParams,parametros=new URLSearchParams();
 for(const k of ['q','comuna','situacion','ver','editar','guardado'])if(typeof p[k]==='string')parametros.set(k,p[k].slice(0,150));
 return redirect(SECCIONES_DIRECTORIO[seccion].href+(parametros.size?'?'+parametros:'')+(parametros.has('ver')||parametros.has('editar')?'#ficha-directorio':''));
}
