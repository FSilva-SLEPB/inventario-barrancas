import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {obtenerAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {formularioImagenLimitado,origenInsumoValido} from '@/lib/imagenes-insumos';
import {abrirExcel,ErrorExcel,MAX_EXCEL} from '@/lib/importacion-excel/lector';
import {prepararExcel,TIPOS_EXCEL,type TipoExcel,type ContextoExcel} from '@/lib/importacion-excel/preparar';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import {esIdSede} from '@/lib/validacion-sedes';
import {prepararExcelP02,anioConfirmadoP02,type PrefijoP02} from '@/lib/p02/preparar';
const respuesta=(d:unknown,status=200)=>NextResponse.json(d,{status,headers:{'Cache-Control':'private, no-store'}});
export async function procesarImportacionExcel(req:Request,p02=false){
 const actor=await obtenerAcceso();if(!actor)return respuesta({error:'Inicia sesión.'},401);
 if(!origenInsumoValido(req))return respuesta({error:'Origen no permitido.'},403);
 try{
  const f=await formularioImagenLimitado(req,MAX_EXCEL+65536),permitidos=['operacion','tipo','hoja','archivo','mapeo','id','aceptar',...(p02?['anioNumeracion','confirmarAnio']:[])];
  if([...f.keys()].some(k=>!permitidos.includes(k)||f.getAll(k).length!==1))throw new ErrorExcel('Formulario inválido.');
  const op=f.get('operacion'),tipo=f.get('tipo');
  if(typeof tipo!=='string'||!Object.hasOwn(TIPOS_EXCEL,tipo)||!['hojas','previa','confirmar'].includes(String(op)))throw new ErrorExcel('Selecciona una modalidad de carga válida.');
  if(p02&&tipo!=='establecimientos')throw new ErrorExcel('Esta carga es exclusiva de establecimientos y jardines P02.');
  if(!p02&&tipo==='establecimientos')return respuesta({error:'Utiliza Importar Excel P02 desde el inventario de establecimientos.',ruta:'/inventario/p02/importar'},409);
  if(!puedeImportarExcel(actor,tipo as TipoExcel))return respuesta({error:'No tienes permisos globales para esta carga.'},403);
  const db=obtenerBaseDatos();
  await db.query('SELECT public.exigir_importacion_excel($1,$2)',[actor.email,tipo]);
  if(op==='confirmar'){
   const id=f.get('id');if(typeof id!=='string'||!esIdSede(id)||f.get('aceptar')!=='si')throw new ErrorExcel('Revisa y acepta la vista previa antes de confirmar.');
   const cliente=await db.connect();let resultado:unknown;
   try{await cliente.query('BEGIN');await cliente.query("SET LOCAL statement_timeout='90s'");const r=await cliente.query(p02?'SELECT public.p02_confirmar_importacion($1,$2) AS r':'SELECT public.confirmar_importacion_excel($1,$2) AS r',[actor.email,id]);resultado=r.rows[0].r;await cliente.query('COMMIT');}catch(e){await cliente.query('ROLLBACK');throw e;}finally{cliente.release();}
   revalidatePath('/','layout');return respuesta({guardado:resultado});
  }
  const archivo=f.get('archivo');if(!(archivo instanceof File)||!archivo.name.toLowerCase().endsWith('.xlsx')||archivo.size>MAX_EXCEL)throw new ErrorExcel('Selecciona un .xlsx de hasta 5 MB.');
  const bytes=new Uint8Array(await archivo.arrayBuffer()),libro=abrirExcel(bytes);
  if(op==='hojas')return respuesta({hojas:libro.hojas.map(h=>h.nombre)});
  const hoja=f.get('hoja');if(typeof hoja!=='string')throw new ErrorExcel('Selecciona la hoja.');
  let mapeo:Record<string,string>={};const crudo=f.get('mapeo');if(crudo!==null){if(typeof crudo!=='string'||crudo.length>16000)throw new ErrorExcel('Correspondencias inválidas.');mapeo=JSON.parse(crudo);if(!mapeo||Array.isArray(mapeo)||typeof mapeo!=='object'||Object.entries(mapeo).some(([k,v])=>k.length>120||typeof v!=='string'||!esIdSede(v)))throw new ErrorExcel('Correspondencias inválidas.');}
  const inventario=tipo!=='funcionarios',personas=tipo==='funcionarios'||tipo==='vinculos';
  const [sedes,categorias,equipos,funcionarios,asignaciones]=await Promise.all([
   inventario?db.query('SELECT id,rbd,tipo,activo FROM public.sedes'):Promise.resolve({rows:[]}),
   inventario?db.query('SELECT id,nombre,activo FROM public.categorias_bienes'):Promise.resolve({rows:[]}),
   inventario?db.query(`SELECT id,serie,numero_inventario AS inventario,sede_id AS "sedeId",version,custodia,estado_administrativo AS estado,COALESCE(datos_compra->'bajaPendienteTI'='true'::jsonb,false) AS pendiente FROM public.equipos`):Promise.resolve({rows:[]}),
   personas?db.query('SELECT id,rut,correo,nombre,version,activo FROM public.funcionarios_nc'):Promise.resolve({rows:[]}),
   tipo==='vinculos'?db.query('SELECT equipo_id AS "equipoId",funcionario_id AS "funcionarioId" FROM public.asignaciones_funcionarios WHERE equipo_id IS NOT NULL AND finalizado_en IS NULL'):Promise.resolve({rows:[]})
  ]);
  const contexto={sedes:sedes.rows,categorias:categorias.rows,equipos:equipos.rows,funcionarios:funcionarios.rows,asignaciones:asignaciones.rows} as ContextoExcel;
  const anio=p02?anioConfirmadoP02(f.get('anioNumeracion'),f.get('confirmarAnio')):null;
  const prefijos=p02?(await db.query<{r:PrefijoP02[]}>('SELECT public.p02_consultar_prefijos($1) r',[actor.email])).rows[0].r:[];
  const preparado=p02?prepararExcelP02(libro.leer(hoja),contexto,prefijos,anio,mapeo):prepararExcel(libro.leer(hoja),tipo as TipoExcel,contexto,mapeo);
  let id='';if(preparado.operaciones.length){
   const nombre=archivo.name.split(/[\\/]/).pop()!.replace(/[\p{Cc}]/gu,'').slice(0,200)||'inventario.xlsx';
   const sha=createHash('sha256').update(bytes).digest('hex');
   id=p02?(await db.query('SELECT public.p02_preparar_importacion($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb) id',[actor.email,nombre,sha,hoja,JSON.stringify(preparado.operaciones),anio,JSON.stringify('configNumeracion' in preparado?preparado.configNumeracion:[])])).rows[0].id:(await db.query('SELECT public.preparar_importacion_excel($1,$2,$3,$4,$5,$6::jsonb) AS id',[actor.email,nombre,sha,tipo,hoja,JSON.stringify(preparado.operaciones)])).rows[0].id;
  }
  return respuesta({id,vista:preparado.vista,excluidas:preparado.excluidas,totalFilas:preparado.totalFilas,unidades:preparado.unidades,avisos:preparado.avisosGenerales,categoriasPendientes:preparado.categoriasPendientes,categorias:categorias.rows.filter(c=>c.activo).map(c=>({id:c.id,nombre:c.nombre}))});
 }catch(e){const code=(e as {code?:string}).code;
  if(code==='42501')return respuesta({error:'Los permisos cambiaron o la vista previa pertenece a otra cuenta.'},403);
  if(code==='P4501')return respuesta({error:'Falta un prefijo P02 activo o confirmar el año de numeración.'},400);
  if(code==='P4303')return respuesta({error:'Se agotó el correlativo de una categoría y año. No se guardó la carga.'},409);
  if(code==='P4502'||code==='P4201'||code==='23505'||code==='P3501')return respuesta({error:'Los datos cambiaron o la vista previa venció. Prepara otra revisión; no se guardaron cambios parciales.'},409);
  if(e instanceof ErrorExcel)return respuesta({error:e.message},400);
  return respuesta({error:'No se pudo procesar la carga. Revisa el archivo y vuelve a preparar la vista previa. No se guardaron cambios parciales.'},400);
 }
}
