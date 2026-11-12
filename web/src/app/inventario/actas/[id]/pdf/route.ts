import {exigirAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {notFound} from 'next/navigation';
import {obtenerActa} from '@/lib/actas';
import {folioActa} from '@/lib/validacion-actas';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await exigirAcceso(),{id}=await params,a=await obtenerActa(id,true);if(!a?.pdf)notFound();const p=new URL(request.url).searchParams,accion=p.get('descargar')==='si'?'descargar':p.get('imprimir')==='si'?'imprimir':'consultar';if(!(await obtenerBaseDatos().query<{ok:boolean}>('SELECT public.rbac_acta_autorizada($1,$2,$3) ok',[actor.email,id,accion])).rows[0].ok)return new Response(null,{status:403});
 return new Response(new Uint8Array(a.pdf),{headers:{'Content-Type':'application/pdf','Content-Length':String(a.pdf.length),'Content-Disposition':(new URL(request.url).searchParams.get('descargar')==='si'?'attachment':'inline')+'; filename="'+folioActa(a.folio)+'.pdf"','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Acta-SHA256':a.sha256}});
}
