import {redirect} from 'next/navigation';
import {exigirAcceso} from '@/lib/acceso';
import {destinoRobosAnterior} from '@/lib/robos-anterior';
export default async function DashboardAnterior({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirAcceso();redirect(destinoRobosAnterior(await searchParams));
}
