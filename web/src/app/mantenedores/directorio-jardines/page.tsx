import DirectorioAnterior from '@/components/directorio-anterior';
import type {BusquedaDirectorio} from '@/components/vista-directorio';
export default function Anterior({searchParams}:{searchParams:Promise<BusquedaDirectorio>}){return <DirectorioAnterior seccion="jardines" searchParams={searchParams}/>;}
