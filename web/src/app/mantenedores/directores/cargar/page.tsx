import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
export default async function CargarAnterior(){await exigirAdministrador();redirect('/directorio/cargar');}
