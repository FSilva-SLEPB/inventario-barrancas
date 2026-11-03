import VistaDirectorio,{type BusquedaDirectorio} from '@/components/vista-directorio';
import {SECCIONES_DIRECTORIO} from '@/lib/secciones-directorio';
export const metadata={title:SECCIONES_DIRECTORIO.directoras.titulo+' | Inventario'};
export default function Directorio({searchParams}:{searchParams:Promise<BusquedaDirectorio>}){return <VistaDirectorio seccion="directoras" searchParams={searchParams}/>;}
