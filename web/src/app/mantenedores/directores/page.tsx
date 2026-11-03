import Link from 'next/link';
import {redirect,notFound} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {listarDirectorio} from '@/lib/directorio';
import {SECCIONES_DIRECTORIO,enlaceDirectorio} from '@/lib/secciones-directorio';
export const metadata={title:'Directorios | Inventario'};
export default async function Directorios({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirAdministrador();const p=await searchParams,id=typeof p.editar==='string'?p.editar:typeof p.ver==='string'?p.ver:'';
 if(id){const d=(await listarDirectorio()).find(d=>d.sedeId===id);if(!d)notFound();redirect(enlaceDirectorio(d.tipo==='jardin_infantil'?'directoras':'directores','',p.editar?'editar':'ver',id));}
 return <main><header><h1>Directorios</h1><p className="descripcion-pagina">Consulta por separado los datos de establecimientos y jardines, y los de sus directores y directoras.</p><p><Link href="/mantenedores">Volver a Mantenedores</Link></p></header><div className="accesos-modulo">{Object.entries(SECCIONES_DIRECTORIO).map(([k,c])=><Link key={k} className="acceso-modulo" href={c.href}><h2>{c.titulo}</h2><p>{c.personas?'Identificación y estado contractual de la persona vigente.':'Identificación y contacto institucional.'}</p><strong>Consultar →</strong></Link>)}</div><p><Link href="/mantenedores/directores/cargar">Cargar listado</Link></p></main>;
}
