import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
export default async function ModeloAnterior(){await exigirPermiso('perfiles','consultar');redirect('/documentacion/modelo-datos');}
