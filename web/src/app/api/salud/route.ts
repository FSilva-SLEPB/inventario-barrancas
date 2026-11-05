import {autenticacionConfigurada} from '@/lib/configuracion-auth';
import {obtenerBaseDatos} from '@/lib/db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!autenticacionConfigurada())return Response.json({estado:'no_disponible'},{status:503,headers});
 try{
  const db=obtenerBaseDatos();
  await db.query('SELECT id,custodia FROM public.equipos LIMIT 0');
  await db.query('SELECT id FROM public.funcionarios_nc LIMIT 0');
  await db.query('SELECT telefono,version,custodia FROM public.celulares LIMIT 0');
  await db.query('SELECT id FROM public.movimientos_inventario LIMIT 0');
  await db.query('SELECT id,pdf,sha256,entrega_id FROM public.actas_documentos LIMIT 0');
  await db.query('SELECT id FROM public.actas_envios LIMIT 0');
  await db.query('SELECT nombres,apellidos FROM public.directorio_sedes LIMIT 0');
  const r=await db.query<{listo:boolean}>("SELECT to_regprocedure('public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text)') IS NOT NULL AND to_regprocedure('public.guardar_sede_directorio_acceso(text,uuid,jsonb,text,text)') IS NOT NULL AND to_regprocedure('public.guardar_celular_acceso(text,uuid,jsonb,integer,text)') IS NOT NULL AND to_regprocedure('public.mover_bien_acceso(text,uuid,jsonb)') IS NOT NULL AND to_regprocedure('public.preparar_acta_acceso(text,uuid,uuid,jsonb)') IS NOT NULL AND to_regprocedure('public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb)') IS NOT NULL AND to_regprocedure('public.normalizar_metadata_acta(jsonb,boolean)') IS NOT NULL AND to_regprocedure('public.version_modelo_acta()') IS NOT NULL AND to_regprocedure('public.version_flujo_acta()') IS NOT NULL AND to_regprocedure('public.validar_receptor_nc_acceso(text,uuid,uuid)') IS NOT NULL AND to_regprocedure('public.iniciar_envio_acta_acceso(text,uuid,uuid,text[],text,boolean)') IS NOT NULL AS listo");
  if(!r.rows[0]?.listo)return Response.json({estado:'no_disponible'},{status:503,headers});
  return Response.json({estado:'ok'},{headers});
 }catch{return Response.json({estado:'no_disponible'},{status:503,headers});}
}
