import {NextResponse} from 'next/server';import {revalidatePath} from 'next/cache';
import {obtenerAcceso} from '@/lib/acceso';import {obtenerBaseDatos} from '@/lib/db';import {tienePermiso} from '@/lib/rbac';
import {formularioImagenLimitado,origenInsumoValido} from '@/lib/imagenes-insumos';import {puedeNumerar} from '@/lib/identificacion/acceso';import {esIdSede} from '@/lib/validacion-sedes';
export async function POST(req:Request){
 const a=await obtenerAcceso();if(!a)return NextResponse.json({error:'Inicia sesión.'},{status:401});
 if(!origenInsumoValido(req)||!puedeNumerar(a,'confirmar'))return NextResponse.json({error:'Sin permiso para administrar la numeración.'},{status:403});
 try{
  const f=await formularioImagenLimitado(req,131072),campos=['operacion','solicitud','filas','anio','categoria','version','prefijo','activo'];if([...f.keys()].some(k=>!campos.includes(k)||f.getAll(k).length!==1))throw new Error('Formulario inválido.');
  const id=f.get('solicitud'),op=f.get('operacion');if(typeof id!=='string'||!esIdSede(id))throw new Error('Solicitud inválida.');let resultado:unknown;
  if(op==='generar'){
   const filas=JSON.parse(String(f.get('filas'))),anio=f.get('anio');if(!Array.isArray(filas)||filas.length>150||!filas.length||anio!==''&&(typeof anio!=='string'||!/^(19|20)\d{2}$/.test(anio)))throw new Error('Revisa selección y año de OC.');
   resultado=(await obtenerBaseDatos().query('SELECT public.generar_numeros_inventario($1,$2,$3::jsonb,$4) r',[a.email,id,JSON.stringify(filas),anio===''?null:Number(anio)])).rows[0].r;
  }else if(op==='configurar'){
   if(!tienePermiso(a,'categorias','editar'))return NextResponse.json({error:'Sin permiso para configurar categorías.'},{status:403});
   const categoria=f.get('categoria'),v=f.get('version'),prefijo=f.get('prefijo'),activo=f.get('activo');
   if(typeof categoria!=='string'||!esIdSede(categoria)||typeof v!=='string'||!/^\d{1,9}$/.test(v)||typeof prefijo!=='string'||!/^[A-Z]{2,5}$/.test(prefijo)||!['si','no'].includes(String(activo)))throw new Error('Revisa categoría y prefijo de 2 a 5 letras mayúsculas.');
   resultado=(await obtenerBaseDatos().query('SELECT public.guardar_config_numeracion($1,$2,$3,$4,$5,$6) r',[a.email,id,categoria,Number(v),prefijo,activo==='si'])).rows[0].r;
  }else throw new Error('Operación inválida.');
  revalidatePath('/inventario','layout');return NextResponse.json({resultado},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const c=(e as {code?:string}).code;return NextResponse.json({error:c==='42501'?'Tu permiso ya no está vigente.':c==='P4301'?'Cambió un equipo, el prefijo o la solicitud. Recarga la revisión antes de confirmar.':c==='P4303'?'Se agotó el correlativo de cuatro dígitos para ese prefijo y año.':c==='22023'?'Revisa la serie, número pendiente, prefijo activo y fecha o año de OC. No se guardaron cambios parciales.':'No se pudo generar la numeración. Revisa los datos; no se guardaron cambios parciales.'},{status:c==='42501'?403:['P4301','P4303','23505'].includes(c??'')?409:400});}
}
