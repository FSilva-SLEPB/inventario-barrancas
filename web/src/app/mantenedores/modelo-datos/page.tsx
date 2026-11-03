import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
export default async function ModeloAnterior(){await exigirAdministrador();redirect('/documentacion/modelo-datos');}
