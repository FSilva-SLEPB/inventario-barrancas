import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
export default async function CargarAnterior(){await exigirPermiso('directorio_institucional','registrar');redirect('/directorio/cargar');}
