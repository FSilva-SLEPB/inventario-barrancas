// Ensayo transaccional desde esquema 43. No usar sobre producción.
import assert from'node:assert/strict';import{createHash}from'node:crypto';import pg from'pg';import migracion from'../migrations/1797004800000_directorio-nc.cjs';
assert.ok(process.env.TEST_ADMIN_DATABASE_URL);const db=new pg.Client(process.env.TEST_ADMIN_DATABASE_URL);await db.connect();try{
 assert.equal(Number((await db.query('SELECT count(*) n FROM public.pgmigrations')).rows[0].n),43);await db.query('BEGIN');
 const gt=(await db.query("SELECT id FROM public.rbac_perfiles WHERE codigo='gestor_tic'")).rows[0].id;await db.query("DELETE FROM public.rbac_perfil_permisos WHERE perfil_id=$1 AND permiso='equipos.editar'",[gt]);
 const excluidas=['rbac_permisos','rbac_perfil_permisos','rbac_limites_perfiles','rbac_anteriores','rbac_cambios_migracion','pgmigrations'];
 const catalogo=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND NOT table_name=ANY($1::text[]) ORDER BY table_name",[excluidas])).rows;
 const hash=async tabla=>createHash('sha256').update(JSON.stringify((await db.query('SELECT dato::text FROM (SELECT to_jsonb(t)'+(['usuarios_acceso','rbac_perfiles'].includes(tabla)?"-'version'":'')+' dato FROM public."'+tabla+'" t)x ORDER BY dato::text')).rows)).digest('hex');
 const antes={};for(const t of catalogo)antes[t.table_name]=await hash(t.table_name);let sql;migracion.up({sql:s=>sql=s});await db.query(sql);for(const t of catalogo)assert.equal(await hash(t.table_name),antes[t.table_name],t.table_name);
 assert.equal((await db.query("SELECT count(*) n FROM public.rbac_perfil_permisos WHERE perfil_id=$1 AND permiso='directorio_nc.consultar'",[gt])).rows[0].n,'0');
 assert.equal((await db.query("SELECT count(*) n FROM public.rbac_perfil_permisos pp JOIN public.rbac_perfiles p ON p.id=pp.perfil_id WHERE p.codigo='sistema' AND pp.permiso='directorio_nc.consultar'")).rows[0].n,'1');
 for(const codigo of ['enlaces_ee','director_ee','directora_ji','auditor','insumos'])assert.equal((await db.query("SELECT count(*) n FROM public.rbac_perfil_permisos pp JOIN public.rbac_perfiles p ON p.id=pp.perfil_id WHERE p.codigo=$1 AND pp.permiso='directorio_nc.consultar'",[codigo])).rows[0].n,'0');
 assert.equal((await db.query("SELECT count(*) n FROM public.rbac_cambios_migracion WHERE nombre='1797004800000_directorio-nc'")).rows[0].n,'1');
 console.log('Migración44: '+catalogo.length+' tablas previas idénticas por SHA256 salvo versiones de acceso; conserva usuarios, sedes, documentos, fotografías, asignaciones e historial. Gestor reducido sin ampliación y perfiles externos sin permisos nuevos. Ensayo revertido.');
}finally{await db.query('ROLLBACK');await db.end();}
