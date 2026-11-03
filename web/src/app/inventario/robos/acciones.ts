'use server';
import {destinoConExito} from '@/lib/aviso-exito';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador,exigirGestionDependencias} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {validarReporteRobo,fechaRobo,textoRobo} from '@/lib/validacion-robos';
export type EstadoRobo={estado:'inicial'|'error';mensaje:string;valores?:Record<string,string>};
const hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function fallo(e:unknown,f:FormData):EstadoRobo{
 const valores:Record<string,string>={};for(const k of ['fecha','lugar','descripcion','enlace','motivo','equipo','operacion']){const v=f.get(k);if(typeof v==='string')valores[k]=v.slice(0,3000);}
 const code=(e as {code?:string})?.code;
 if(!code)return {estado:'error',valores,mensaje:e instanceof Error?e.message:'No se pudo guardar.'};
 const mensajes:Record<string,string>={'42501':'Tu cuenta no tiene permiso para esta operación.',P2301:'Los datos cambiaron. Recarga y revisa la selección antes de guardar.',P2302:'Algún equipo ya tiene un incidente abierto. No se guardaron cambios parciales.',P2303:'La solicitud ya se usó con otros datos. Recarga el formulario.','22023':'Revisa equipos, fechas y antecedentes.'};
 return {estado:'error',valores,mensaje:mensajes[code]??'No se pudo guardar. No se guardaron cambios parciales.'};
}
export async function reportarRobo(_estado:EstadoRobo,f:FormData):Promise<EstadoRobo>{
 const actor=await exigirGestionDependencias();let id:string;
 try{const reporte=validarReporteRobo(f,hoy());id=reporte.id;await obtenerBaseDatos().query('SELECT public.reportar_robo_acceso($1,$2::uuid,$3::jsonb)',[actor.email,id,JSON.stringify(reporte.datos)]);}catch(e){return fallo(e,f);}
 revalidatePath('/inventario','layout');redirect(destinoConExito('/inventario/robos/'+id, 'robo'));
}
export async function actualizarRobo(_estado:EstadoRobo,f:FormData):Promise<EstadoRobo>{
 const actor=await exigirAdministrador();let id:string;
 try{
  for(const k of ['id','version','operacion','motivo'])if(f.getAll(k).length!==1)throw new Error('Formulario inválido. Recarga la página.');
  const valor=f.get('id'),version=Number(f.get('version')),operacion=f.get('operacion');
  if(typeof valor!=='string'||!esIdSede(valor)||!Number.isInteger(version)||version<1||version>2147483646)throw new Error('Formulario inválido.');id=valor;
  const motivo=textoRobo(f.get('motivo'),'el motivo',1000,true);
  if(operacion==='validado'||operacion==='rechazado')await obtenerBaseDatos().query('SELECT public.resolver_robo_acceso($1,$2::uuid,$3,$4,$5)',[actor.email,id,version,operacion,motivo]);
  else if(operacion==='recuperado'){
   const equipo=f.get('equipo');if(f.getAll('equipo').length!==1||typeof equipo!=='string'||!esIdSede(equipo)||f.getAll('fecha').length!==1)throw new Error('Selecciona un equipo y su fecha de recuperación.');
   const fecha=fechaRobo(f.get('fecha'),hoy());await obtenerBaseDatos().query('SELECT public.recuperar_equipo_robo_acceso($1,$2::uuid,$3,$4::uuid,$5::date,$6)',[actor.email,id,version,equipo,fecha,motivo]);
  }else throw new Error('Operación inválida.');
 }catch(e){return fallo(e,f);}
 revalidatePath('/inventario','layout');redirect(destinoConExito('/inventario/robos/'+id, 'robo'));
}
