// Importación opcional de fotos anteriores. Solo lectura salvo --aplicar.
import pg from 'pg';
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,sep,basename} from 'node:path';
const args=process.argv.slice(2),valor=k=>args[args.indexOf(k)+1];
if(!args.includes('--actor')||!args.includes('--directorio')||!process.env.DATABASE_URL)throw new Error('Indica --actor, --directorio y DATABASE_URL. Sin --aplicar es solo revisión.');
const root=await realpath(valor('--directorio')),actor=valor('--actor'),db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
let aptas=0,faltantes=0,guardadas=0;
try{
 const usuario=(await db.query("SELECT 1 FROM public.usuarios_acceso WHERE correo=$1 AND activo AND rol IN ('administrador','administrador_gestion')",[actor])).rowCount;if(!usuario)throw new Error('Operador no autorizado.');
 const {rows}=await db.query("SELECT id,foto_url FROM public.catalogo_insumos WHERE foto_url LIKE '/uploads/insumos/%' ORDER BY id");
 for(const r of rows){
  try{
   const nombre=basename(r.foto_url);if(!/^[A-Za-z0-9._-]+\.(png|jpg|jpeg|webp)$/.test(nombre))throw new Error('Nombre inválido');
   const ruta=await realpath(resolve(root,nombre));if(!ruta.startsWith(root+sep))throw new Error('Ruta inválida');const s=await stat(ruta);if(!s.isFile()||s.size<12||s.size>5242880)throw new Error('Archivo inválido');aptas++;
   if(!args.includes('--aplicar'))continue;
   const b=await readFile(ruta),mime=nombre.endsWith('.png')?'image/png':nombre.endsWith('.webp')?'image/webp':'image/jpeg';
   await db.query('BEGIN');
   const actual=(await db.query('SELECT foto_url FROM public.catalogo_insumos WHERE id=$1',[r.id])).rows[0];if(actual?.foto_url!==r.foto_url){await db.query('ROLLBACK');continue;}
   const id=crypto.randomUUID();await db.query('SELECT public.guardar_foto_insumo_acceso($1,$2::uuid,$3,$4::bytea)',[actor,id,mime,b]);await db.query('SELECT public.importar_foto_insumo_acceso($1,$2::uuid,$3::uuid,$4)',[actor,r.id,id,r.foto_url]);await db.query('COMMIT');guardadas++;
  }catch{await db.query('ROLLBACK').catch(()=>{});faltantes++;}
 }
 console.log(JSON.stringify({modo:args.includes('--aplicar')?'aplicacion':'solo_lectura',referencias:rows.length,aptas,faltantes,guardadas}));if(faltantes)process.exitCode=1;
}finally{await db.end();}
