import {exigirAcceso} from '@/lib/acceso';
import {requiereSede} from '@/lib/politica-acceso';
import {dashboardRobos} from '@/lib/robos';
import {filtrosDashboardRobos,csvDashboardRobos} from '@/lib/dashboard-robos';
export const dynamic='force-dynamic';
export async function GET(peticion:Request){
 const actor=await exigirAcceso(),url=new URL(peticion.url),p:Record<string,string|string[]>={};
 for(const k of new Set(url.searchParams.keys())){const valores=url.searchParams.getAll(k);p[k]=valores.length===1?valores[0]:valores;}
 const hoy=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Santiago'}).format(new Date());
 const {filtros,errores}=filtrosDashboardRobos(p,requiereSede(actor.rol),hoy);
 if(errores.length)return new Response(errores.join('\n'),{status:400,headers:{'Cache-Control':'private, no-store','Content-Type':'text/plain; charset=utf-8'}});
 const datos=await dashboardRobos(filtros);
 return new Response(csvDashboardRobos(datos,filtros),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="resumen-robos.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
