'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import FormularioEstadosActivo from '@/components/formulario-estados-activo';
import {guardarEstadosInventario} from '@/app/inventario/estados-acciones';
import {mostrarExito} from '@/components/avisos-guardado';
import {ESTADOS_CONDICION_ACTIVO,type EstadoAdministrativoActivo,type EstadoCondicionActivo,type RegistroEstadoActivo} from '@/lib/estados-activo';
export default function EstadosInventario({clase,bien}:{clase:'equipo'|'celular';bien:{id:string;version:number;condicionTecnica:string;estadoAdministrativo:EstadoAdministrativoActivo;fechaBaja:string|null;custodia:string;bajaPendienteTI?:boolean}}){
 const router=useRouter(),version=useRef(bien.version),solicitudPendiente=useRef<{firma:string;id:string}|null>(null),[aviso,setAviso]=useState('');
 const persistir=async(actual:RegistroEstadoActivo)=>{
  const datos={clase,id:bien.id,version:version.current,administrativo:actual.estadoAdministrativo,condicion:actual.estadoCondicion},firma=JSON.stringify(datos);
  if(solicitudPendiente.current?.firma!==firma)solicitudPendiente.current={firma,id:crypto.randomUUID()};
  const r=await guardarEstadosInventario(solicitudPendiente.current!.id,datos);
  if(!r.ok)throw new Error(r.mensaje);
  version.current=r.version;solicitudPendiente.current=null;
  setAviso(actual.estadoAdministrativo==='dado_de_baja'?'Baja guardada. El registro queda archivado y de solo lectura.':'Estados actualizados correctamente.');
  // El éxito visual no decide el resultado de la escritura ni provoca un reintento.
  void mostrarExito('Actualización exitosa',actual.estadoAdministrativo==='dado_de_baja'?'Registro archivado como histórico.':'Estados del activo guardados.').catch(()=>{});
  return Object.freeze({...actual,fechaBaja:r.fechaBaja});
 };
 const condicion=Object.hasOwn(ESTADOS_CONDICION_ACTIVO,bien.condicionTecnica)?bien.condicionTecnica as EstadoCondicionActivo:'';
 return <section className="ficha-seccion"><h3>Estados del activo</h3><p className="ayuda-catalogos">El estado administrativo se guarda al seleccionarlo. Para modificar únicamente la condición, selecciona su valor y guarda los cambios.</p>
 {bien.bajaPendienteTI&&<p className="ayuda-catalogos">Revisa el antecedente de baja importado. Guardar un estado confirmado por TI resuelve este pendiente y conserva el historial; confirmar Dado de baja registra la baja en la fecha actual.</p>}
 {bien.custodia==='en_prestamo'?<p>Devuelve el préstamo antes de cambiar los estados.</p>:<FormularioEstadosActivo activoId={bien.id} soloEstados inicial={{estadoAdministrativo:bien.estadoAdministrativo,estadoCondicion:condicion,fechaBaja:bien.fechaBaja}} onConfirmarCambioAdministrativo={persistir} onCambio={(a,b)=>{if(a.estadoAdministrativo!==b.estadoAdministrativo)router.refresh();}} onGuardar={async r=>{if(r.estadoAdministrativo==='activo'&&!r.estadoCondicion)throw new Error('Selecciona una condición antes de guardar. La condición registrada se conserva.');await persistir(r);router.refresh();}} ejecutarProtocoloSeguridad={id=>setAviso('Protocolo de seguridad simulado para '+id+'. El incidente de robo se gestiona en su módulo.')}/>}
 {!condicion&&bien.estadoAdministrativo==='activo'&&<p>La condición anterior está pendiente de clasificación. Selecciona una condición para actualizarla.</p>}<p role="status">{aviso}</p>
 </section>;
}
