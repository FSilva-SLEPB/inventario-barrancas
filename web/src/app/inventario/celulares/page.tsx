import Link from 'next/link';
import {exigirAcceso} from '@/lib/acceso';
export const metadata={title:'Inventario de celulares | Inventario'};
export default async function Celulares(){await exigirAcceso();return <main><header><h1>Inventario de celulares</h1><p className="descripcion-pagina">Este módulo se desarrollará en una próxima etapa.</p></header><section className="estado-modulo"><h2>Gestión pendiente de definir</h2><p>Aquí se incorporará el inventario de celulares cuando revisemos sus datos y funcionamiento.</p><Link className="btn btn-outline-primary" href="/inventario">Volver a Inventario</Link></section></main>;}
