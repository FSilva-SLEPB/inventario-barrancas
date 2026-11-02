import './validacion-runtime.mjs';
import {createHash} from 'node:crypto';
import pg from 'pg';
const args=process.argv.slice(2);
if(args.includes('--ayuda')){console.log('Uso: node scripts/cargar-directorio.mjs --actor correo@slepb.gob.cl [--confirmar] < listado.txt\nSin --confirmar solo valida el listado y muestra cantidades. La fuente no se guarda en Git ni se imprime.');process.exit(0);}
const indice=args.indexOf('--actor'),actor=indice>=0?args[indice+1]:'';
if(!/^[a-z0-9._%+-]+@slepb\.gob\.cl$/.test(actor??'')||!process.env.DATABASE_URL){console.error('Indica --actor con una cuenta institucional autorizada y configura DATABASE_URL.');process.exit(1);}
const {prepararDirectorio}=await import('../src/lib/validacion-directorio.ts');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:15000,application_name:'inventario_carga_directorio'});
try{
 await db.connect();
 const permiso=await db.query("SELECT 1 FROM public.usuarios_acceso WHERE correo=$1 AND activo AND rol IN ('administrador','administrador_gestion')",[actor]);
 if(!permiso.rows.length)throw new Error('La cuenta indicada no tiene permiso para cargar el directorio.');
 const partes=[];let bytes=0;for await(const parte of process.stdin){const b=Buffer.from(parte);bytes+=b.length;if(bytes>1024*1024)throw new Error('El listado debe ser texto UTF-8 de hasta 1 MB.');partes.push(b);}
 const buffer=Buffer.concat(partes);if(!buffer.length||buffer.length>1024*1024)throw new Error('El listado debe ser texto UTF-8 de hasta 1 MB.');
 const hash=createHash('sha256').update(buffer).digest('hex');
 if(args.includes('--confirmar')&&(await db.query('SELECT 1 FROM public.directorio_cargas WHERE sha256=$1',[hash])).rows.length){console.log('El listado ya estaba cargado; no se duplicó el historial.');}
 else{
  const {rows}=await db.query('SELECT s.id AS "sedeId",s.nombre AS "sedeNombre",s.rbd,s.direccion,s.comuna,s.correo_institucional AS "correoInstitucional",d.nombre,d.rut,d.correo,d.situacion,d.observaciones,COALESCE(d.version,0) AS version FROM public.sedes s LEFT JOIN public.directorio_sedes d ON d.sede_id=s.id WHERE s.activo AND s.tipo IN (\'establecimiento\',\'jardin_infantil\') ORDER BY s.id');
  const {datos,vista,omitidas}=prepararDirectorio(new TextDecoder('utf-8',{fatal:true}).decode(buffer),rows);
  const situaciones=Object.fromEntries(['titular','subrogante','vacante','pendiente'].map(k=>[k,datos.filter(d=>d.situacion===k).length]));
  console.log(JSON.stringify({establecimientosJISC:datos.length,fichasConCambios:vista.filter(v=>v.cambios.length).length,situaciones,filasNivelCentralExcluidas:omitidas.length},null,2));
  if(args.includes('--confirmar')){await db.query('SELECT public.cargar_directorio_acceso($1,$2::jsonb,$3,$4)',[actor,JSON.stringify(datos),hash,'listado-institucional.txt']);console.log('Directorio cargado con historial. Las entregas anteriores conservan sus datos originales.');}
  else console.log('Revisión completada; no se modificaron registros. Agrega --confirmar para ejecutar la carga.');
 }
}catch(e){console.error(e?.code?'La carga no se pudo completar. Revisa permisos, migraciones o cambios concurrentes; no se guardaron cambios parciales.':e instanceof Error?e.message:'No se pudo revisar el listado.');process.exitCode=1;}
finally{await db.end();}
