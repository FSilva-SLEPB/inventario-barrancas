import Link from 'next/link';
import {redirect} from 'next/navigation';
import {exigirAlguno} from '@/lib/acceso';
import {modulosSistema} from '@/lib/modulos';
import PortadaModulo from '@/components/portada-modulo';
export const metadata={title:'Directorio | Inventario'};
export default async function Directorio(){const actor=await exigirAlguno('directorio_institucional.consultar','directorio_personas.consultar','directorio_nc.consultar');const modulo=modulosSistema(actor).find(m=>m.id==='directorio');if(!modulo)redirect('/sin-permiso');return <PortadaModulo modulo={modulo}>{actor.permisos?.includes('directorio_institucional.registrar')&&<div className="acciones-catalogos"><Link className="btn btn-outline-primary btn-sm" scroll={false} href="/directorio/cargar">Cargar listado</Link></div>}</PortadaModulo>;}
