'use server';
import {exigirGestionDependencias} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {normalizarRut} from '@/lib/validacion-directorio';
import {revalidatePath} from 'next/cache';
export async function gestionarReporteIncidente(solicitud:string,id:string,version:number,accion:string,datos:Record<string,unknown>){
 const a=await exigirGestionDependencias();
 if(!esIdSede(solicitud)||!esIdSede(id)||!Number.isInteger(version)||version<0||version>=2147483647||!['guardar','enviar','validar','rechazar'].includes(accion)||!datos||JSON.stringify(datos).length>150000)return {ok:false as const,mensaje:'Solicitud inválida.'};
 if(accion==='guardar'&&datos.rut){const rut=normalizarRut(datos.rut);if(!rut)return {ok:false as const,mensaje:'Revisa el RUT de quien realizó la denuncia.'};datos={...datos,rut};}
 try{
  const r=(await obtenerBaseDatos().query<{r:{id:string;version:number;estado:string}}>('SELECT public.gestionar_reporte_incidente_acceso($1,$2::uuid,$3::uuid,$4,$5,$6::jsonb) AS r',[a.email,solicitud,id,version,accion,JSON.stringify(datos)])).rows[0].r;
  revalidatePath('/inventario','layout');return {ok:true as const,...r};
 }catch(e){const c=(e as {code?:string}).code;return {ok:false as const,mensaje:c==='42501'?'No tienes permiso sobre este reporte o los bienes seleccionados.':c==='P3501'?'El reporte o un bien cambió, o ya existe otro envío pendiente. Vuelve a abrirlo y revisa su selección.':c==='P2802'?'El bien está en préstamo; TI debe revisar su devolución.':c==='22023'?'Revisa fecha, descripción y selección de bienes. Para enviar un robo, completa parte, denunciante y RUT.':'No se pudo guardar. Se conserva el reporte anterior.'};}
}
