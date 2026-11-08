import 'server-only';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import type {DatosFuncionario} from '@/lib/validacion-funcionarios';
export type FuncionarioNC=Omit<DatosFuncionario,'rut'|'correo'|'fechaIngreso'>&{id:string;rut:string|null;correo:string|null;fechaIngreso:string|null;version:number;actualizadoPor:string;actualizadoEn:string};
export type FiltrosFuncionarios={q:string;estado:'activo'|'inactivo'|'';pagina:number;limite?:number};
const columnas='id,nombre,rut,correo,unidad,subdireccion,cargo,fecha_ingreso::text AS "fechaIngreso",activo,version,actualizado_por AS "actualizadoPor",actualizado_en::text AS "actualizadoEn"';
export async function listarFuncionarios(f:FiltrosFuncionarios){
 await exigirAdministrador();const db=obtenerBaseDatos(),filtro=`WHERE ($1='' OR nombre ILIKE '%'||$1||'%' OR rut ILIKE '%'||replace($1,'.','')||'%' OR correo ILIKE '%'||$1||'%' OR unidad ILIKE '%'||$1||'%' OR subdireccion ILIKE '%'||$1||'%' OR cargo ILIKE '%'||$1||'%') AND ($2='' OR activo=($2='activo'))`;
 const limite=[50,100,150].includes(f.limite??50)?f.limite??50:50;
 const total=Number((await db.query<{n:string}>('SELECT count(*) AS n FROM public.funcionarios_nc '+filtro,[f.q,f.estado])).rows[0].n),paginas=Math.max(1,Math.ceil(total/limite)),pagina=Math.min(f.pagina,paginas);
 const {rows}=await db.query<FuncionarioNC>(`SELECT ${columnas} FROM public.funcionarios_nc ${filtro} ORDER BY lower(nombre),id LIMIT $3 OFFSET $4`,[f.q,f.estado,limite,(pagina-1)*limite]);
 return {filas:rows,total,paginas,pagina};
}
export async function detalleFuncionario(id:string){
 await exigirAdministrador();const db=obtenerBaseDatos(),{rows}=await db.query<FuncionarioNC>(`SELECT ${columnas} FROM public.funcionarios_nc WHERE id=$1::uuid`,[id]);
 if(!rows[0])return null;
 const historia=await db.query<{id:string;actor:string;motivo:string;antes:Record<string,unknown>|null;despues:Record<string,unknown>;fecha:string}>(`SELECT id::text,COALESCE(NULLIF(btrim(u.nombre),''),'Funcionario UTIC') AS actor,motivo,antes,despues,registrado_en::text AS fecha FROM public.funcionarios_nc_historial h LEFT JOIN public.usuarios_acceso u ON u.correo=h.actor WHERE funcionario_id=$1::uuid ORDER BY registrado_en DESC,id DESC LIMIT 50`,[id]);
 return {funcionario:rows[0],historial:historia.rows};
}
