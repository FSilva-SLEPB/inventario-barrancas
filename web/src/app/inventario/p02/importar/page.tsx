import Link from 'next/link';
import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import ImportarExcel from '@/components/importar-excel';
export const metadata={title:'Importar Excel P02 | Inventario'};
export default async function ImportarP02(){const a=await exigirPermiso('equipos','registrar');if(!puedeImportarExcel(a,'establecimientos'))redirect('/sin-permiso');return <main><header><h1>Importar Excel P02</h1><p className="descripcion-pagina">Establecimientos, jardines infantiles y salas cuna. Revisa las filas y confirma el ingreso con numeración automática.</p></header><div className="acciones-catalogos"><Link href="/inventario/p02" className="btn btn-outline-primary">Volver a Inventario P02</Link><a href="/api/p02/plantilla" download className="btn btn-outline-primary">Descargar plantilla Excel P02</a></div><ImportarExcel tipos={['establecimientos']} inicial="establecimientos" p02/></main>;}
