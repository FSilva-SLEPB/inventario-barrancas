
import FichaEquipo from '@/components/ficha-equipo';
export const metadata={title:'Ficha e historial del equipo | Inventario'};
export default async function PaginaEquipo({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{id},p]=await Promise.all([params,searchParams]);
 return <FichaEquipo id={id} editar={p.editar==='si'} guardado={p.guardado==='1'}/>;
}
