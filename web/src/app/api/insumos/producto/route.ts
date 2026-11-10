import {NextResponse} from 'next/server';
import {obtenerAcceso} from '@/lib/acceso';
import {puedeAdministrar} from '@/lib/politica-acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {formularioImagenLimitado,origenInsumoValido} from '@/lib/imagenes-insumos';
import {revalidatePath} from 'next/cache';
export async function POST(req:Request){
 const actor=await obtenerAcceso();if(!actor)return NextResponse.json({error:'Inicia sesión.'},{status:401});
 if(!puedeAdministrar(actor.rol)||!origenInsumoValido(req))return NextResponse.json({error:'Operación no permitida.'},{status:403});
 try{
  if(Number(req.headers.get('content-length'))>4096)return NextResponse.json({error:'Solicitud inválida.'},{status:400});
  const f=await formularioImagenLimitado(req,4096),producto=f.get('producto_id'),url=f.get('foto_url');
  const imagen=typeof url==='string'?/^\/api\/insumos\/imagen\?id=([0-9a-f-]{36})$/.exec(url)?.[1]:null;
  if(f.getAll('producto_id').length!==1||f.getAll('foto_url').length!==1||typeof producto!=='string'||!esIdSede(producto)||typeof imagen!=='string'||!esIdSede(imagen))return NextResponse.json({error:'Producto o imagen inválidos.'},{status:400});
  await obtenerBaseDatos().query('SELECT public.asignar_foto_insumo_acceso($1,$2::uuid,$3::uuid)',[actor.email,producto,imagen]);
  revalidatePath('/insumos','layout');revalidatePath('/mantenedores/insumos');return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'No se pudo asociar la imagen al producto.'},{status:400});}
}
