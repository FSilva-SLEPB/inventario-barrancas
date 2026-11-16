import Link from 'next/link';
import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {accesosPortadaInventario,puedeAbrirInventario,type AmbitoPortada} from '@/lib/portadas-inventario';
import PortadaModulo from '@/components/portada-modulo';
export default async function PortadaInventario({ambito}:{ambito:AmbitoPortada}){
 const actor=await exigirPermiso('equipos');if(!puedeAbrirInventario(actor,ambito))redirect('/sin-permiso');
 const p02=ambito==='p02';
 return <PortadaModulo modulo={{id:'inventario',titulo:p02?'Inventario P02':'Inventario Nivel Central',href:p02?'/inventario/p02/inicio':'/inventario/nivel-central/inicio',descripcion:p02?'Equipos de establecimientos educacionales, jardines infantiles y salas cuna. Selecciona el proceso P02 que necesitas realizar.':'Equipos de Nivel Central. Las asignaciones a funcionarios y sus actas se realizan desde el bien, con su ficha vinculada.',accesos:accesosPortadaInventario(actor,ambito)}}><div className="acciones-catalogos"><Link className="btn btn-outline-primary" href="/inventario">Volver a Inventario</Link></div></PortadaModulo>;
}
