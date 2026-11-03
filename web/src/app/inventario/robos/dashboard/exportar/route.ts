import {exigirAcceso} from '@/lib/acceso';
import {destinoRobosAnterior} from '@/lib/robos-anterior';
export const dynamic='force-dynamic';
export async function GET(peticion:Request){
 await exigirAcceso();const p:Record<string,string>={};for(const[k,v]of new URL(peticion.url).searchParams)p[k]=v;
 return new Response(null,{status:307,headers:{Location:destinoRobosAnterior(p),'Cache-Control':'private, no-store'}});
}
