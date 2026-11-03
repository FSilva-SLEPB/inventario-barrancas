import {redirect,notFound} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {listarDirectorio} from '@/lib/directorio';
import {enlaceDirectorio} from '@/lib/secciones-directorio';
export const metadata={title:'Directorios | Inventario'};
export default async function Directorios({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirAdministrador();const p=await searchParams,id=typeof p.editar==='string'?p.editar:typeof p.ver==='string'?p.ver:'';
 if(id){const d=(await listarDirectorio()).find(d=>d.sedeId===id);if(!d)notFound();redirect(enlaceDirectorio(d.tipo==='jardin_infantil'?'directoras':'directores','',p.editar?'editar':'ver',id));}
 redirect('/directorio');
}
