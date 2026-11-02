import {exigirAcceso} from '@/lib/acceso';
import {modulosSistema} from '@/lib/modulos';
import PortadaModulo from '@/components/portada-modulo';
export const metadata={title:'Mantenedores | Inventario SLEP Barrancas'};
export default async function Mantenedores(){const acceso=await exigirAcceso();return <PortadaModulo modulo={modulosSistema(acceso.rol).find(m=>m.id==='mantenedores')!}/>;}
