// Ejecutar en la instalación con DATABASE_URL de aplicación; no cambia datos.
// No guardar el resultado en Git: puede contener estructura interna de sedes.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../web/package.json',import.meta.url)),{Client}=require('pg');
if(!process.env.DATABASE_URL)throw new Error('Configura DATABASE_URL de la instalación, sin publicarla.');
const db=new Client({connectionString:process.env.DATABASE_URL});await db.connect();
try{await db.query('BEGIN READ ONLY');const informe={};
 for(const [nombre,sql] of Object.entries({categorias:"SELECT id,nombre FROM public.categorias_bienes WHERE activo ORDER BY nombre",sedes:"SELECT id,tipo,rbd,nombre FROM public.sedes WHERE activo ORDER BY tipo,nombre",dependencias:"SELECT id,sede_id,nombre FROM public.dependencias WHERE activo ORDER BY sede_id,nombre",productos_insumos:"SELECT id,codigo,nombre,categoria,unidad FROM public.catalogo_insumos WHERE activo ORDER BY nombre",categorias_insumos:"SELECT nombre,prefijo FROM public.categorias_insumos_codigos ORDER BY nombre",bodegas:"SELECT id,nombre FROM public.ubicaciones_bodega WHERE activo ORDER BY nombre",estructura_funcionarios:"SELECT DISTINCT subdireccion,unidad,cargo FROM public.funcionarios_nc WHERE activo ORDER BY subdireccion,unidad,cargo"}))informe[nombre]=(await db.query(sql)).rows;
 await db.query('ROLLBACK');console.log(JSON.stringify(informe,null,2));
}finally{await db.end();}
