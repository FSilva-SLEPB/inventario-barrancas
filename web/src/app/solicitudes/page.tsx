import {redirect} from 'next/navigation';
import {exigirAcceso} from '@/lib/acceso';

export default async function Solicitudes(){
  await exigirAcceso('insumos');
  redirect('/insumos');
}
