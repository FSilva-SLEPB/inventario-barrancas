import {notFound} from 'next/navigation';
import {obtenerActa} from '@/lib/actas';
import {folioActa} from '@/lib/validacion-actas';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params,a=await obtenerActa(id,true);if(!a?.pdf)notFound();
 return new Response(new Uint8Array(a.pdf),{headers:{'Content-Type':'application/pdf','Content-Length':String(a.pdf.length),'Content-Disposition':(new URL(request.url).searchParams.get('descargar')==='si'?'attachment':'inline')+'; filename="'+folioActa(a.folio)+'.pdf"','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Acta-SHA256':a.sha256}});
}
