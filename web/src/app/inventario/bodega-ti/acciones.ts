'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {retornoMovimiento} from '@/lib/validacion-movimientos-inventario';
import {destinoConExito} from '@/lib/aviso-exito';
export type EstadoUbicacion={estado:'inicial'|'error';mensaje:string;revision:string;ubicacion:string};
export async function guardarUbicacionBodega(_previo:EstadoUbicacion,f:FormData):Promise<EstadoUbicacion>{
 const actor=await exigirAdministrador(),revision=randomUUID(),v:Record<string,string>={},campos=['solicitud','tipo','bienId','version','ubicacion','volver'];
 const fallo=(mensaje:string):EstadoUbicacion=>({estado:'error',mensaje,revision,ubicacion:v.ubicacion??''});
 if([...f.keys()].some(k=>!campos.includes(k)&&!k.startsWith('$ACTION')))return fallo('Formulario inválido. Vuelve a abrir la ventana.');
 for(const k of campos){const raw=f.get(k);if(f.getAll(k).length!==1||typeof raw!=='string'||raw.length>(k==='volver'?2000:50)||/\p{Cc}/u.test(raw))return fallo('Formulario inválido. Vuelve a abrir la ventana.');v[k]=raw;}
 const volver=retornoMovimiento(v.volver);
 if(!volver||!volver.startsWith('/inventario/bodega-ti')||!esIdSede(v.solicitud)||!esIdSede(v.bienId)||!['equipo','celular'].includes(v.tipo)||v.ubicacion&&!esIdSede(v.ubicacion)||!/^\d{1,10}$/.test(v.version)||Number(v.version)<1||Number(v.version)>=2147483647)return fallo('La identificación, versión o ubicación no es válida.');
 try{await obtenerBaseDatos().query('SELECT public.ubicar_bien_bodega_acceso($1,$2::uuid,$3::jsonb)',[actor.email,v.solicitud,JSON.stringify({tipo:v.tipo,bienId:v.bienId,version:Number(v.version),ubicacion:v.ubicacion})]);}
 catch(e){const c=(e as {code?:string}).code;return fallo(c==='P3201'?'El bien cambió. Cierra y vuelve a abrir la ventana antes de guardar.':c==='P3202'?'El estado o la custodia del bien ya no permiten ubicarlo. Revisa su ficha.':'No se pudo confirmar la ubicación. Se conserva el registro anterior.');}
 revalidatePath('/inventario','layout');redirect(destinoConExito(volver));
}
