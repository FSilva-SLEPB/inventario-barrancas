import {NextResponse} from 'next/server';import {revalidatePath} from 'next/cache';import {obtenerAcceso} from '@/lib/acceso';import {obtenerBaseDatos} from '@/lib/db';
import {formularioImagenLimitado,origenInsumoValido} from '@/lib/imagenes-insumos';import {esIdSede} from '@/lib/validacion-sedes';import {tienePermiso} from '@/lib/rbac';
import {crearPdfEtiquetas} from '@/lib/identificacion/pdf-etiquetas';import {validarOpcionesEtiqueta,type BienIdentificacion} from '@/lib/identificacion/reglas';
const fallo=(e:unknown)=>{const c=(e as {code?:string}).code;return NextResponse.json({error:c==='42501'?'No tienes acceso a este lote o a sus equipos.':c==='P4301'?'Los datos cambiaron o la solicitud ya se utilizó. Prepara nuevamente el lote.':c?'No se pudo preparar la etiqueta. Revisa la selección, sus versiones y permisos.':e instanceof Error&&/^(El QR|El equipo|Selecciona|Opciones|Usa posición|Formulario|Solicitud|Operación)/.test(e.message)?e.message:'No se pudo preparar la etiqueta.'},{status:c==='42501'?403:c==='P4301'?409:400,headers:{'Cache-Control':'private, no-store'}});};
export async function POST(req:Request){
 const a=await obtenerAcceso();if(!a)return NextResponse.json({error:'Inicia sesión.'},{status:401});if(!origenInsumoValido(req)||!tienePermiso(a,'etiquetas_inventario')||!tienePermiso(a,'equipos'))return NextResponse.json({error:'Sin permiso.'},{status:403});
 try{const f=await formularioImagenLimitado(req,131072),campos=['operacion','solicitud','filas','opciones','accion'];if([...f.keys()].some(k=>!campos.includes(k)||f.getAll(k).length!==1))throw new Error('Formulario inválido.');
  const id=f.get('solicitud'),op=f.get('operacion');if(typeof id!=='string'||!esIdSede(id))throw new Error('Solicitud inválida.');
  if(op==='preparar'){
   const accion=f.get('accion');if(!['imprimir','descargar'].includes(String(accion))||!tienePermiso(a,'etiquetas_inventario',String(accion)))return NextResponse.json({error:'Acción no autorizada.'},{status:403});
   const filas=JSON.parse(String(f.get('filas'))),opciones=validarOpcionesEtiqueta(JSON.parse(String(f.get('opciones'))));
   const bienes=(await obtenerBaseDatos().query<{r:BienIdentificacion[]}>('SELECT public.datos_etiquetas($1,$2::jsonb,$3) r',[a.email,JSON.stringify(filas),accion])).rows[0].r;
   const pdf=await crearPdfEtiquetas(bienes,opciones);
   await obtenerBaseDatos().query('SELECT public.registrar_etiquetas($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7::bytea)',[a.email,id,JSON.stringify(filas),JSON.stringify(opciones),accion,JSON.stringify(bienes),pdf]);
  }else if(op==='confirmar'||op==='cancelar'){await obtenerBaseDatos().query('SELECT public.confirmar_impresion_etiquetas($1,$2,$3)',[a.email,id,op==='confirmar']);}else throw new Error('Operación inválida.');
  revalidatePath('/inventario/etiquetas');return NextResponse.json({id,estado:op},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return fallo(e);}
}
export async function GET(req:Request){
 const a=await obtenerAcceso();if(!a)return new Response(null,{status:401});const p=new URL(req.url).searchParams,id=p.get('id'),accion=p.get('accion')??'descargar';if(!id||!esIdSede(id)||!['descargar','imprimir'].includes(accion))return new Response(null,{status:400});
 try{const pdf=(await obtenerBaseDatos().query<{pdf:Buffer}>('SELECT public.consultar_pdf_etiquetas($1,$2,$3) pdf',[a.email,id,accion])).rows[0].pdf;return new Response(new Uint8Array(pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':(accion==='imprimir'?'inline':'attachment')+'; filename="etiquetas-inventario.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(e){return fallo(e);}
}
