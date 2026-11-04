import 'server-only';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
import {generarPdfActa} from '@/lib/pdf-actas';
import type {DatosActa,MetadataActa} from '@/lib/validacion-actas';
export type ActaDocumento={id:string;movimientoId:string|null;entregaId:string|null;folio:string;version:number;datos:DatosActa;sha256:string;actor:string;emitidoEn:string;pdf?:Buffer};
export async function fuenteActa(id:string){await exigirAdministrador();if(!esIdSede(id))return null;return(await obtenerBaseDatos().query<{id:string;accion:'asignacion'|'devolucion';fecha:string;receptor:string;actor:string;motivo:string;equipoId:string|null;antes:Record<string,unknown>;despues:Record<string,unknown>;actaId:string|null}>(`SELECT m.id,m.accion,m.fecha::text,m.receptor,m.actor,m.motivo,m.equipo_id AS "equipoId",m.antes,m.despues,a.id AS "actaId" FROM public.movimientos_inventario m LEFT JOIN public.actas_documentos a ON a.movimiento_id=m.id AND a.pdf IS NOT NULL WHERE m.id=$1`,[id])).rows[0]??null;}
export async function emitirActa(id:string,movimiento:string,metadata:MetadataActa,historica=false){
 const actor=await exigirAdministrador(),db=await obtenerBaseDatos().connect();
 try{await db.query('BEGIN');const r=(await db.query<{r:{id:string;datos:DatosActa;completa:boolean}}>(historica?'SELECT public.preparar_acta_entrega_acceso($1,$2,$3,$4::jsonb) AS r':'SELECT public.preparar_acta_acceso($1,$2,$3,$4::jsonb) AS r',[actor.email,id,movimiento,JSON.stringify(metadata)])).rows[0].r;
 if(!r.completa){const pdf=await generarPdfActa(r.datos);await db.query('SELECT public.completar_pdf_acta_acceso($1,$2,$3)',[actor.email,id,pdf]);}
 await db.query('COMMIT');return r.id;
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
export async function obtenerActa(id:string,conPdf=false){await exigirAdministrador();if(!esIdSede(id))return null;return(await obtenerBaseDatos().query<ActaDocumento>(`SELECT id,movimiento_id AS "movimientoId",entrega_id AS "entregaId",folio::text,version,datos,sha256,actor,emitido_en::text AS "emitidoEn"${conPdf?',pdf':''} FROM public.actas_documentos WHERE id=$1 AND pdf IS NOT NULL`,[id])).rows[0]??null;}
export async function listarActas(f:{q:string;pagina:number;limite:number}){
 await exigirAdministrador();const db=obtenerBaseDatos(),where=`WHERE pdf IS NOT NULL AND ($1='' OR 'ACT-'||lpad(folio::text,GREATEST(6,length(folio::text)),'0') ILIKE '%'||$1||'%' OR datos->>'receptorNombre' ILIKE '%'||$1||'%' OR datos->>'sedeNombre' ILIKE '%'||$1||'%')`;
 const total=Number((await db.query<{n:string}>('SELECT count(*) AS n FROM public.actas_documentos '+where,[f.q])).rows[0].n),paginas=Math.max(1,Math.ceil(total/f.limite)),pagina=Math.min(f.pagina,paginas);
 const filas=(await db.query<ActaDocumento>(`SELECT id,movimiento_id AS "movimientoId",entrega_id AS "entregaId",folio::text,version,datos,sha256,actor,emitido_en::text AS "emitidoEn" FROM public.actas_documentos ${where} ORDER BY folio DESC LIMIT $2 OFFSET $3`,[f.q,f.limite,(pagina-1)*f.limite])).rows;return {filas,total,pagina,paginas};
}
export type EnvioActa={id:string;estado:string;actor:string;destinatarios:string[];remitente:string;creadoEn:string;terminadoEn:string|null;resultado:Record<string,unknown>};
export async function enviosActa(id:string){await exigirAdministrador();return(await obtenerBaseDatos().query<EnvioActa>(`SELECT id,CASE WHEN estado='en_curso' AND creado_en<CURRENT_TIMESTAMP-INTERVAL '2 minutes' THEN 'no_confirmado' ELSE estado END AS estado,actor,destinatarios,remitente,creado_en::text AS "creadoEn",terminado_en::text AS "terminadoEn",resultado FROM public.actas_envios WHERE acta_id=$1 ORDER BY creado_en DESC,id DESC LIMIT 50`,[id])).rows;}
export const ESTADOS_ENVIO:Record<string,string>={en_curso:'Envío en curso',aceptado:'Aceptado por el servidor de correo',parcial:'Envío aceptado parcialmente',fallido:'No enviado',no_confirmado:'Resultado por confirmar'};

export async function fuenteActaEntrega(id:string){
 await exigirAdministrador();if(!esIdSede(id))return null;
 return(await obtenerBaseDatos().query<{id:string;fecha:string;receptor:string;cargo:string;rut:string;correo:string;sedeNombre:string;cantidad:number;actaId:string|null}>(`SELECT e.id,e.fecha_entrega::text AS fecha,e.receptor_nombre AS receptor,e.receptor_cargo AS cargo,COALESCE(e.receptor_datos->>'rut','') AS rut,COALESCE(e.receptor_datos->>'correo','') AS correo,e.sede_nombre AS "sedeNombre",(SELECT count(*)::integer FROM public.entregas_detalle d WHERE d.entrega_id=e.id) AS cantidad,a.id AS "actaId" FROM public.entregas_equipos e LEFT JOIN public.actas_documentos a ON a.entrega_id=e.id AND a.pdf IS NOT NULL WHERE e.id=$1`,[id])).rows[0]??null;
}
