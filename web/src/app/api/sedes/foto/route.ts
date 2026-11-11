import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {obtenerAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {puedeAdministrar,requiereSede} from '@/lib/politica-acceso';
import {puedeEditarFotoSede} from '@/lib/politica-fotos-sedes';
import {esIdSede} from '@/lib/validacion-sedes';
// Reutilizar el límite, detección de formato y protección de origen de fotografías.
import {formularioImagenLimitado,imagenInsumoValida,origenInsumoValido} from '@/lib/imagenes-insumos';
export async function POST(req:Request){
 const actor=await obtenerAcceso();if(!actor)return NextResponse.json({error:'Inicia sesión.'},{status:401});
 if((!puedeAdministrar(actor.rol)&&actor.rol!=='encargado')||!origenInsumoValido(req))return NextResponse.json({error:'Operación no permitida.'},{status:403});
 try{
  const f=await formularioImagenLimitado(req),campos=['sede','solicitud','version','imagen'];
  if([...f.keys()].some(k=>!campos.includes(k))||campos.some(k=>f.getAll(k).length!==1))return NextResponse.json({error:'Formulario inválido.'},{status:400});
  const sede=f.get('sede'),id=f.get('solicitud'),version=f.get('version'),archivo=f.get('imagen');
  if(typeof sede!=='string'||!esIdSede(sede)||typeof id!=='string'||!esIdSede(id)||typeof version!=='string'||!/^\d{1,10}$/.test(version)||Number(version)>=2147483647||!(archivo instanceof File))return NextResponse.json({error:'Fotografía o sede inválida.'},{status:400});
  if(!puedeEditarFotoSede(actor.rol,actor.sedeId,sede))return NextResponse.json({error:'No tienes permiso para cambiar esta fotografía.'},{status:403});
  const contenido=Buffer.from(await archivo.arrayBuffer());if(!imagenInsumoValida(archivo.type,contenido))return NextResponse.json({error:'Usa JPG, PNG o WEBP de hasta 5 MB.'},{status:400});
  const r=(await obtenerBaseDatos().query<{r:{id:string;version:number;repetida:boolean}}>('SELECT public.guardar_fotografia_sede_acceso($1,$2::uuid,$3::uuid,$4::integer,$5,$6::bytea) AS r',[actor.email,id,sede,Number(version),archivo.type,contenido])).rows[0].r;
  revalidatePath('/');return NextResponse.json(r,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const c=(e as {code?:string}).code;return NextResponse.json({error:c==='P3402'?'Otra persona cambió la fotografía. Revisa la actual antes de volver a subirla.':c==='P3401'||c==='23505'?'Esta solicitud ya se utilizó. Vuelve a seleccionar la fotografía.':c==='42501'?'Ya no tienes permiso para cambiar la fotografía.':'No se pudo guardar la fotografía. Revisa su formato y tamaño.'},{status:c==='42501'?403:c==='P3402'||c==='P3401'||c==='23505'?409:400});}
}
export async function GET(req:Request){
 const actor=await obtenerAcceso();if(!actor)return new Response(null,{status:401});
 if(!puedeAdministrar(actor.rol)&&actor.rol!=='consulta'&&!requiereSede(actor.rol))return new Response(null,{status:403});
 const id=new URL(req.url).searchParams.get('id');if(!id||!esIdSede(id))return new Response(null,{status:404});
 const r=(await obtenerBaseDatos().query<{mime:string;contenido:Buffer}>('SELECT mime,contenido FROM public.fotografias_sedes WHERE id=$1 AND ($2::boolean OR sede_id=$3::uuid)',[id,puedeAdministrar(actor.rol)||actor.rol==='consulta',actor.sedeId])).rows[0];if(!r)return new Response(null,{status:404});
 return new Response(new Uint8Array(r.contenido),{headers:{'Content-Type':r.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
