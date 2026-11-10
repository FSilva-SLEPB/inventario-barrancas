import Link from 'next/link';
import {exigirAdministrador} from '@/lib/acceso';
import {modulosSistema} from '@/lib/modulos';
import PortadaModulo from '@/components/portada-modulo';
export const metadata={title:'Directorio | Inventario'};
export default async function Directorio(){const actor=await exigirAdministrador();return <PortadaModulo modulo={modulosSistema(actor.rol).find(m=>m.id==='directorio')!}><div className="acciones-catalogos"><Link className="btn btn-outline-primary btn-sm" scroll={false} href="/directorio/cargar">Cargar listado</Link></div></PortadaModulo>;}
