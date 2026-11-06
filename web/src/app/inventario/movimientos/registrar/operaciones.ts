'use server';
import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {CAMPOS_OPERACION_INVENTARIO,validarOperacionInventario} from '@/lib/validacion-operaciones-inventario';
import {CAMPOS_ACTA,metadatosActa,type MetadataActa} from '@/lib/validacion-actas';
import {esIdSede} from '@/lib/validacion-sedes';
import {completarActaEnTransaccion} from '@/lib/actas';
import {destinoConExito} from '@/lib/aviso-exito';
import type {EstadoMovimiento} from './acciones';
export async function registrarOperacion(_anterior:EstadoMovimiento,f:FormData):Promise<EstadoMovimiento>{
 const actor=await exigirAdministrador(),campos=[...CAMPOS_OPERACION_INVENTARIO,'actaSolicitud','funcionario',...Object.keys(CAMPOS_ACTA)],valores:Record<string,string>={};
 for(const k of campos){const v=f.get(k);valores[k]=typeof v==='string'?v.slice(0,k==='devoluciones'||k==='entregas'?150000:2500):'';}
 const error=(mensaje:string):EstadoMovimiento=>({estado:'error',mensaje,valores,revision:randomUUID()});
 let p:ReturnType<typeof validarOperacionInventario>,metadata:MetadataActa;
 try{
  if(campos.some(k=>f.getAll(k).length!==1||typeof f.get(k)!=='string')||[...f.keys()].some(k=>!campos.includes(k)&&!k.startsWith('$ACTION'))||!esIdSede(valores.actaSolicitud)||valores.funcionario!==''&&valores.funcionario!=='manual'&&!esIdSede(valores.funcionario))throw new Error('Formulario inválido. Reabre la operación desde el bien.');
  metadata=metadatosActa(valores);const base=new FormData();for(const k of CAMPOS_OPERACION_INVENTARIO)base.set(k,valores[k]);
  base.set('receptorDevolucion',valores.tipo==='cambio'?metadata.entregaNombre:'');p=validarOperacionInventario(base);
 }catch(e){return error(e instanceof Error?e.message:'Revisa los datos de la operación.');}
 let db:import('pg').PoolClient|undefined;
 try{
  db=await obtenerBaseDatos().connect();await db.query('BEGIN');
  const r=(await db.query<{r:{repetida:boolean}}>('SELECT public.mover_operacion_acceso($1,$2,$3::jsonb) AS r',[actor.email,p.solicitud,JSON.stringify(p.datos)])).rows[0].r;
  if(!r.repetida&&(await db.query<{tipo:string}>('SELECT tipo FROM public.sedes WHERE id=$1',[p.datos.destino])).rows[0]?.tipo==='nivel_central'&&!valores.funcionario)throw Object.assign(new Error('Selecciona funcionario o persona manual'),{code:'22023'});
  if(valores.funcionario&&!r.repetida)await db.query('SELECT public.validar_receptor_nc_acceso($1,$2::uuid,$3::uuid)',[actor.email,valores.funcionario==='manual'?null:valores.funcionario,p.datos.destino]);
  await completarActaEnTransaccion(db,actor.email,valores.actaSolicitud,p.solicitud,metadata,'operacion');await db.query('COMMIT');
 }catch(e){if(db)await db.query('ROLLBACK').catch(()=>{});const mensajes:Record<string,string>={P2901:'Revisa la procedencia y la ruta. Nivel Central requiere Bodega TI; entre sedes educativas se admite entrega directa. En un cambio, los devueltos pertenecen a la sede receptora.',P2601:'Un bien cambió o la solicitud fue utilizada. Reabre la operación para revisar las versiones.',P2602:'El estado de un bien cambió. Devuelve primero los bienes de Nivel Central a Bodega TI.',P2604:'Un bien o una sede ya no están disponibles.',P2605:'Hay un incidente de robo abierto; registra su recuperación antes de mover el bien.',P2701:'El acta ya existe o la solicitud fue utilizada con otros datos.',P2802:'Devuelve el préstamo antes de otra operación.','42501':'Solo UTIC puede confirmar operaciones.','22023':'Revisa las selecciones, participantes y fecha de la operación.'};return error(mensajes[(e as {code?:string}).code??'']??'No se guardó la operación ni el acta. No quedaron cambios parciales.');
 }finally{db?.release();}
 revalidatePath('/inventario','layout');const retorno=new URL(p.volver,'http://inventario.local');retorno.searchParams.set('acta',valores.actaSolicitud);redirect(destinoConExito(retorno.pathname+retorno.search,p.datos.tipo));
}
