// Copia de ensayo en esquema 41; comparación integral antes/después y rollback.
import assert from 'node:assert/strict';import{createHash}from'node:crypto';import pg from'pg';import migracion from'../migrations/1796832000000_importacion-excel.cjs';
assert.ok(process.env.TEST_ADMIN_DATABASE_URL);const db=new pg.Client(process.env.TEST_ADMIN_DATABASE_URL);await db.connect();try{
 assert.equal(Number((await db.query('SELECT count(*) n FROM public.pgmigrations')).rows[0].n),41);
 const catalogo=(await db.query("SELECT table_name,array_agg(column_name::text ORDER BY ordinal_position) columnas FROM information_schema.columns WHERE table_schema='public' AND table_name<>'pgmigrations' GROUP BY table_name ORDER BY table_name")).rows,q=v=>'"'+v.replaceAll('"','""')+'"';
 async function hash(t){return createHash('sha256').update(JSON.stringify((await db.query('SELECT row_to_json(t)::text dato FROM (SELECT '+t.columnas.map(q).join(',')+' FROM public.'+q(t.table_name)+')t ORDER BY row_to_json(t)::text')).rows)).digest('hex');}
 const antes={};for(const t of catalogo)antes[t.table_name]=await hash(t);await db.query('BEGIN');let sql;migracion.up({sql:s=>sql=s});await db.query(sql);for(const t of catalogo)assert.equal(await hash(t),antes[t.table_name],t.table_name);
 assert.equal((await db.query('SELECT count(*) n FROM public.importaciones_excel')).rows[0].n,'0');
 console.log('Migración42: '+catalogo.length+' tablas previas idénticas por SHA256; usuarios, asignaciones, documentos, fotos e historial conservados. Ensayo revertido.');
}finally{await db.query('ROLLBACK');await db.end();}
