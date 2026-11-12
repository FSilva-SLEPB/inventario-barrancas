import {tienePermiso} from '@/lib/rbac';
import {NextResponse} from 'next/server';
import {obtenerAcceso} from '@/lib/acceso';

import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {randomUUID} from 'node:crypto';
import {formularioImagenLimitado,imagenInsumoValida,origenInsumoValido} from '@/lib/imagenes-insumos';
export async function POST(req:Request){
 const actor=await obtenerAcceso();if(!actor)return NextResponse.json({error:'Inicia sesión.'},{status:401});
 if(!tienePermiso(actor,'catalogo_insumos','editar')||!origenInsumoValido(req))return NextResponse.json({error:'Operación no permitida.'},{status:403});
 try{
  const f=await formularioImagenLimitado(req),archivo=f.get('imagen');
  if(f.getAll('imagen').length!==1||!(archivo instanceof File))return NextResponse.json({error:'Selecciona una imagen.'},{status:400});
  const contenido=Buffer.from(await archivo.arrayBuffer());
  if(!imagenInsumoValida(archivo.type,contenido))return NextResponse.json({error:'Usa una imagen JPG, PNG o WEBP válida, de hasta 5 MB.'},{status:400});
  const id=randomUUID();await obtenerBaseDatos().query('SELECT public.guardar_foto_insumo_acceso($1,$2::uuid,$3,$4::bytea)',[actor.email,id,archivo.type,contenido]);
  return NextResponse.json({url:'/api/insumos/imagen?id='+id},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'No se pudo guardar la imagen. Revisa su tamaño y formato.'},{status:400});}
}
export async function GET(req:Request){
 const actor=await obtenerAcceso();if(!actor)return new Response(null,{status:401});
 if(!tienePermiso(actor,'catalogo_insumos')&&!tienePermiso(actor,'solicitudes_insumos','registrar')&&!tienePermiso(actor,'seguimiento_insumos'))return new Response(null,{status:403});
 const id=new URL(req.url).searchParams.get('id');if(typeof id!=='string'||!esIdSede(id))return new Response(null,{status:404});
 const {rows}=await obtenerBaseDatos().query<{mime:string;contenido:Buffer}>('SELECT mime,contenido FROM public.imagenes_insumos WHERE id=$1::uuid',[id]);
 if(!rows[0])return new Response(null,{status:404});
 return new Response(new Uint8Array(rows[0].contenido),{headers:{'Content-Type':rows[0].mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
