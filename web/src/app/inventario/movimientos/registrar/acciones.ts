'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {validarMovimiento,retornoMovimiento} from '@/lib/validacion-movimientos-inventario';
import {CAMPOS_ACTA,metadatosActa,type MetadataActa} from '@/lib/validacion-actas';
import {completarActaEnTransaccion} from '@/lib/actas';
import {esIdSede} from '@/lib/validacion-sedes';
import {destinoConExito} from '@/lib/aviso-exito';
export type EstadoMovimiento={estado:'inicial'|'error';mensaje:string;valores:Record<string,string>;revision?:string};
export async function registrarMovimiento(_anterior:EstadoMovimiento,f:FormData):Promise<EstadoMovimiento>{
 const actor=await exigirAdministrador(),valores:Record<string,string>={},camposMovimiento=['solicitud','tipo','bienId','accion','destino','fecha','receptor','motivo','version','volver'],campos=[...camposMovimiento,'actaSolicitud',...Object.keys(CAMPOS_ACTA)];
 for(const k of ['funcionario','destino','fecha','receptor','motivo',...Object.keys(CAMPOS_ACTA)]){const v=f.get(k);valores[k]=typeof v==='string'?v.slice(0,2500):'';}
 const error=(mensaje:string):EstadoMovimiento=>({estado:'error',revision:randomUUID(),mensaje,valores});let preparado:ReturnType<typeof validarMovimiento>,metadata:MetadataActa;const documento=f.get('actaSolicitud');
 try{
  if(campos.some(k=>f.getAll(k).length!==1||typeof f.get(k)!=='string')||[...f.keys()].some(k=>!campos.includes(k)&&k!=='funcionario'&&!k.startsWith('$ACTION'))||typeof documento!=='string'||!esIdSede(documento))throw new Error('Formulario inválido. Vuelve a abrir la operación desde el bien.');
  const soloMovimiento=new FormData();for(const k of camposMovimiento)soloMovimiento.set(k,f.get(k)!);preparado=validarMovimiento(soloMovimiento);
  const funcionario=f.get('funcionario');if(f.getAll('funcionario').length>1||funcionario!==null&&(typeof funcionario!=='string'||funcionario!==''&&funcionario!=='manual'&&!esIdSede(funcionario)))throw new Error('Selecciona un funcionario válido.');
  if(!retornoMovimiento(preparado.volver))throw new Error('Inicia la operación desde Inventario o Bodega TI.');metadata=metadatosActa(valores);
 }catch(e){return error(e instanceof Error?e.message:'Revisa los datos de la operación y del acta.');}
 let db:import('pg').PoolClient|undefined;
 try{db=await obtenerBaseDatos().connect();
  await db.query('BEGIN');const movimiento=await db.query<{r:{repetida?:boolean}}>('SELECT public.mover_bien_acceso($1,$2::uuid,$3::jsonb) AS r',[actor.email,preparado.solicitud,JSON.stringify(preparado.datos)]);
  const funcionario=f.get('funcionario');if(funcionario&&!movimiento.rows[0].r.repetida){if(preparado.datos.accion!=='asignacion')throw Object.assign(new Error('Destino incompatible'),{code:'22023'});await db.query('SELECT public.validar_receptor_nc_acceso($1,$2::uuid,$3::uuid)',[actor.email,funcionario==='manual'?null:funcionario,preparado.datos.destino]);}
  await completarActaEnTransaccion(db,actor.email,documento as string,preparado.solicitud,metadata);await db.query('COMMIT');
 }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});const c=(e as {code?:string}).code,m:Record<string,string>={P2601:'El bien cambió o la solicitud ya fue utilizada. Recarga el registro antes de confirmar.',P2602:'Solo se asigna desde Bodega TI y solo se devuelve un bien asignado.',P2604:'El bien o la sede ya no están disponibles.',P2605:'El equipo tiene un incidente de robo abierto. Revisa su recuperación antes de moverlo.',P2701:'La solicitud del acta ya fue utilizada con otros datos. Revisa el registro.',"42501":'Solo UTIC puede confirmar operaciones.',"22023":'Revisa los datos, participantes y fecha de la operación.'};return error(m[c??'']??'No se pudo completar la operación y su acta. No se guardaron cambios parciales.');
 }finally{db?.release();}
 revalidatePath('/inventario','layout');const destino=new URL(retornoMovimiento(preparado.volver)!,'http://inventario.local');destino.searchParams.set('acta',documento as string);
 redirect(destinoConExito(destino.pathname+destino.search,preparado.datos.accion==='devolucion'?'devolucion':'asignacion'));
}
