import {autenticacionConfigurada} from '@/lib/configuracion-auth';
import {obtenerBaseDatos} from '@/lib/db';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!autenticacionConfigurada())return Response.json({estado:'no_disponible'},{status:503,headers});
 try{
  const db=obtenerBaseDatos();
  await db.query('SELECT id FROM public.equipos LIMIT 0');
  await db.query('SELECT id FROM public.funcionarios_nc LIMIT 0');
  const r=await db.query<{listo:boolean}>("SELECT to_regprocedure('public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text)') IS NOT NULL AS listo");
  if(!r.rows[0]?.listo)return Response.json({estado:'no_disponible'},{status:503,headers});
  return Response.json({estado:'ok'},{headers});
 }catch{return Response.json({estado:'no_disponible'},{status:503,headers});}
}
