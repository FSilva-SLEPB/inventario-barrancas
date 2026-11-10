import {NextResponse} from 'next/server';
import {exigirAdministrador} from '@/lib/acceso';
import {writeFile,mkdir} from 'fs/promises';
import path from 'path';
import {randomUUID} from 'crypto';

const TIPOS:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
const MAX=5*1024*1024;

export async function POST(req:Request){
  try{
    await exigirAdministrador();
    const form=await req.formData();
    const archivo=form.get('imagen');
    if(!(archivo instanceof File)) return NextResponse.json({error:'Selecciona una imagen.'},{status:400});
    if(archivo.size>MAX) return NextResponse.json({error:'La imagen supera 5 MB.'},{status:400});
    const ext=TIPOS[archivo.type];
    if(!ext) return NextResponse.json({error:'Formato no permitido. Usa JPG, PNG o WEBP.'},{status:400});
    const nombre=`${Date.now()}-${randomUUID()}.${ext}`;
    const dir=path.join(process.cwd(),'public','uploads','insumos');
    await mkdir(dir,{recursive:true});
    const buf=Buffer.from(await archivo.arrayBuffer());
    await writeFile(path.join(dir,nombre),buf);
    return NextResponse.json({url:`/uploads/insumos/${nombre}`});
  }catch(e){
    const msg=e instanceof Error?e.message:'No se pudo subir la imagen.';
    return NextResponse.json({error:msg},{status:400});
  }
}
