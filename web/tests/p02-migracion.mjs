// Ensayo transaccional desde esquema 44. No usar sobre producción.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import pg from 'pg';import migracion from '../migrations/1797091200000_p02-ingreso-automatico.cjs';
assert.ok(process.env.TEST_ADMIN_DATABASE_URL);const db=new pg.Client(process.env.TEST_ADMIN_DATABASE_URL);await db.connect();try{
 assert.equal(Number((await db.query('SELECT count(*) n FROM public.pgmigrations')).rows[0].n),44);await db.query('BEGIN');
 const catalogo=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
 const hash=async tabla=>createHash('sha256').update(JSON.stringify((await db.query('SELECT dato::text FROM (SELECT to_jsonb(t)'+(tabla==='importaciones_excel'?"-'p02_numeracion'":'')+' dato FROM public."'+tabla+'" t)x ORDER BY dato::text')).rows)).digest('hex');
 const antes={};for(const t of catalogo)antes[t.table_name]=await hash(t.table_name);let sql;migracion.up({sql:s=>sql=s});await db.query(sql);for(const t of catalogo)assert.equal(await hash(t.table_name),antes[t.table_name],t.table_name);
 assert.equal((await db.query('SELECT count(*) n FROM public.p02_numeros')).rows[0].n,'0');assert.equal((await db.query('SELECT count(*) n FROM public.p02_registros')).rows[0].n,'0');
 assert.equal((await db.query('SELECT count(*) n FROM public.p02_prefijos p FULL JOIN public.numeracion_categorias n USING(categoria_id) WHERE p.categoria_id IS NULL OR n.categoria_id IS NULL OR p.prefijo IS DISTINCT FROM n.prefijo OR p.activo IS DISTINCT FROM n.activo')).rows[0].n,'0');
 for(const fn of ['public.p02_numerar_nuevo(text,uuid,integer)','public.p02_validar_previa(jsonb,integer,jsonb)','public.confirmar_importacion_excel_v44(text,uuid)'])assert.equal((await db.query("SELECT has_function_privilege('inventario_app',$1,'EXECUTE') permiso",[fn])).rows[0].permiso,false);
 console.log('Migración45: '+catalogo.length+' tablas anteriores conservadas por SHA256; copia inicial de prefijos sin numerar, importar ni reclasificar datos. Funciones privadas sin ejecución pública/aplicación. Ensayo revertido.');
}finally{await db.query('ROLLBACK');await db.end();}
