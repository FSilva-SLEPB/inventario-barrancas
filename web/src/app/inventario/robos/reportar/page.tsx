import {redirect} from 'next/navigation';
import {exigirGestionDependencias} from '@/lib/acceso';
export default async function Reportar(){await exigirGestionDependencias();redirect('/inventario/robos?reporte=nuevo');}
