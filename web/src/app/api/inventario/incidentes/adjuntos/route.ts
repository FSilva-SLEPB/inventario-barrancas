import {obtenerAcceso} from '@/lib/acceso';
import {puedeAdministrar} from '@/lib/politica-acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {formularioImagenLimitado,imagenInsumoValida,origenInsumoValido} from '@/lib/imagenes-insumos';
const autorizado=(rol:string)=>puedeAdministrar(rol)||rol==='encargado';
export async function POST(req:Request){
 const a=await obtenerAcceso();if(!a)return Response.json({error:'Inicia sesión.'},{status:401});
 if(!autorizado(a.rol)||!origenInsumoValido(req))return Response.json({error:'Sin autorización.'},{status:403});
 try{
  const f=await formularioImagenLimitado(req,10*1024*1024+65536),campos=['id','reporte','archivo'];
  if([...f.keys()].some(k=>!campos.includes(k))||campos.some(k=>f.getAll(k).length!==1))throw Error();
  const id=f.get('id'),reporte=f.get('reporte'),archivo=f.get('archivo');
  if(typeof id!=='string'||!esIdSede(id)||typeof reporte!=='string'||!esIdSede(reporte)||!(archivo instanceof File))throw Error();
  const b=Buffer.from(await archivo.arrayBuffer()),pdf=archivo.type==='application/pdf'&&b.subarray(0,5).toString()==='%PDF-'&&b.subarray(-1024).includes(Buffer.from('%%EOF'));
  if(b.length<12||b.length>10*1024*1024||!(pdf||imagenInsumoValida(archivo.type,b)))throw Error();
  await obtenerBaseDatos().query('SELECT public.adjuntar_reporte_incidente_acceso($1,$2::uuid,$3::uuid,$4,$5,$6::bytea)',[a.email,id,reporte,archivo.name,archivo.type,b]);
  return Response.json({id},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({error:(e as {code?:string}).code==='42501'?'Sin autorización.':'No se pudo adjuntar. Usa PDF (10 MB) o JPG, PNG, WEBP (5 MB); máximo cinco archivos y 25 MB por reporte.'},{status:(e as {code?:string}).code==='42501'?403:400});}
}
export async function GET(req:Request){
 const a=await obtenerAcceso();if(!a)return new Response(null,{status:401});if(!autorizado(a.rol))return new Response(null,{status:403});
 const id=new URL(req.url).searchParams.get('id');if(!id||!esIdSede(id))return new Response(null,{status:404});
 const r=(await obtenerBaseDatos().query<{nombre:string;mime:string;contenido:Buffer}>(`SELECT x.nombre,x.mime,x.contenido FROM public.reportes_incidentes_adjuntos x JOIN public.reportes_incidentes_inventario r ON r.id=x.reporte_id WHERE x.id=$1 AND ($2::boolean OR r.sede_id=$3::uuid)`,[id,puedeAdministrar(a.rol),a.sedeId])).rows[0];if(!r)return new Response(null,{status:404});
 return new Response(new Uint8Array(r.contenido),{headers:{'Content-Type':r.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(r.nombre),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
