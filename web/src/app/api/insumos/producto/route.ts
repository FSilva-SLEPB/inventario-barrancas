import {NextResponse} from 'next/server';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';

export async function POST(req:Request){
  try{
    await exigirAdministrador();
    const form=await req.formData();
    const productoId=String(form.get('producto_id')||'');
    const fotoUrl=String(form.get('foto_url')||'').trim();
    if(!esIdSede(productoId)) return NextResponse.json({error:'Producto inválido.'},{status:400});
    if(!fotoUrl.startsWith('/uploads/insumos/')) return NextResponse.json({error:'Ruta de imagen inválida.'},{status:400});
    const db=obtenerBaseDatos();
    await db.query(`UPDATE public.catalogo_insumos SET foto_url=$2, actualizado_en=CURRENT_TIMESTAMP WHERE id=$1::uuid`,[productoId,fotoUrl]);
    return NextResponse.json({ok:true});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'No se pudo guardar.'},{status:400});
  }
}
