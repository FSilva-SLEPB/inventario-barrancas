import type {Pool,Client} from 'pg';
export const USO_TABLAS:Record<string,{modulo:string;uso:string;fuentes:string[]}>={
 movimientos_inventario:{modulo:'Movimientos',uso:'Devoluciones a Bodega TI y asignaciones de equipos y celulares, con fecha, receptor, idempotencia e instantáneas.',fuentes:['src/lib/inventario-bodega.ts','migrations/1794268800000_custodia-movimientos-inventario.mjs']},
 celulares:{modulo:'Celulares',uso:'Inventario dedicado de celulares, un teléfono por equipo, sede, identificación, funcionamiento y vigencia.',fuentes:['src/lib/celulares.ts','src/app/inventario/celulares/acciones.ts']},
 celulares_historial:{modulo:'Celulares',uso:'Cambios de datos, número, sede y vigencia del celular con actor, motivo e instantáneas históricas.',fuentes:['src/lib/celulares.ts','migrations/1794182400000_inventario-celulares.mjs']},
 funcionarios_nc:{modulo:'Nivel Central',uso:'Ficha administrativa de funcionarios NC, unidad, contacto y vigencia; separada del acceso al sistema.',fuentes:['src/lib/funcionarios.ts','src/app/mantenedores/funcionarios/acciones.ts']},
 funcionarios_nc_historial:{modulo:'Nivel Central',uso:'Cambios de la ficha del funcionario con actor, motivo y datos anteriores/posteriores.',fuentes:['src/lib/funcionarios.ts','migrations/1794009600000_funcionarios-nivel-central.mjs']},
 sedes:{modulo:'Catálogos',uso:'Identidad y datos de EE/JISC y Nivel Central; alcance por sede.',fuentes:['src/lib/sedes.ts','src/lib/equipos.ts','src/lib/directorio.ts']},
 dependencias:{modulo:'Catálogos',uso:'Ubicaciones internas de una sede. Todavía no hay una FK desde equipos a dependencias.',fuentes:['src/lib/dependencias.ts','src/app/mantenedores/dependencias']},
 categorias_bienes:{modulo:'Catálogos',uso:'Categorías que clasifican los bienes y equipos.',fuentes:['src/lib/catalogos.ts','src/lib/equipos.ts']},
 usuarios_acceso:{modulo:'Acceso',uso:'Cuentas autorizadas, perfil, vigencia y sede permitida.',fuentes:['src/lib/acceso.ts','src/lib/usuarios.ts']},
 usuarios_acceso_historial:{modulo:'Acceso',uso:'Auditoría de cambios de usuarios y permisos.',fuentes:['src/lib/usuarios.ts','migrations/1793404800000_administrar-usuarios.mjs']},
 cargas_equipos:{modulo:'Equipos',uso:'Origen e idempotencia de las cargas masivas de inventario.',fuentes:['src/app/inventario/carga/acciones.ts','src/lib/equipos.ts']},
 equipos:{modulo:'Equipos',uso:'Identidad estable del bien, sede, categoría, funcionamiento, custodia en Bodega TI/asignado y situación de entrega.',fuentes:['src/lib/equipos.ts','src/lib/entregas.ts','src/lib/robos.ts']},
 equipos_historial:{modulo:'Equipos',uso:'Ingresos, ediciones, entregas e incidentes con datos anteriores y posteriores.',fuentes:['src/lib/equipos.ts','src/lib/presentacion-historial.ts']},
 directorio_sedes:{modulo:'Directorio',uso:'Responsable vigente de cada EE/JISC, RUN, contactos y situación del cargo.',fuentes:['src/lib/directorio.ts','src/lib/entregas.ts']},
 directorio_historial:{modulo:'Directorio',uso:'Cambios de responsable y datos del establecimiento; conserva las personas anteriores.',fuentes:['src/lib/directorio.ts','src/app/mantenedores/directores/acciones.ts']},
 directorio_cargas:{modulo:'Directorio',uso:'Registro del hash de cada listado cargado para evitar duplicar cambios.',fuentes:['src/app/mantenedores/directores/acciones.ts','scripts/cargar-directorio.mjs']},
 entregas_lotes:{modulo:'Entregas',uso:'Agrupa una operación de entrega y evita repetirla al reintentar.',fuentes:['src/lib/entregas.ts','src/app/inventario/movimientos/regularizar/acciones.ts']},
 entregas_equipos:{modulo:'Entregas',uso:'Cabecera de entrega por sede, fecha y persona receptora; conserva sus datos históricos.',fuentes:['src/lib/entregas.ts']},
 entregas_detalle:{modulo:'Entregas',uso:'Equipos de cada entrega, con instantáneas anteriores y posteriores.',fuentes:['src/lib/entregas.ts']},
 incidentes_robos:{modulo:'Robos',uso:'Reporte de robo por sede, antecedentes, validación y estado.',fuentes:['src/lib/robos.ts','src/app/inventario/robos/acciones.ts']},
 incidentes_robos_equipos:{modulo:'Robos',uso:'Equipos afectados y recuperación individual dentro de un incidente.',fuentes:['src/lib/robos.ts']},
 incidentes_robos_historial:{modulo:'Robos',uso:'Reporte, revisión y recuperación con usuario, fecha y motivo.',fuentes:['src/lib/robos.ts']},
 pgmigrations:{modulo:'Migraciones',uso:'Control técnico de las migraciones aplicadas; no es una tabla de negocio.',fuentes:['package.json','migrations/']}
};
export type ColumnaModelo={nombre:string;tipo:string;opcional:boolean;primaria:boolean};
export type TablaModelo={nombre:string;modulo:string;uso:string;fuentes:string[];columnas:ColumnaModelo[];registros:string|null;consultable:boolean;conocida:boolean};
export type RelacionModelo={nombre:string;origen:string;destino:string;columnas:string[];referencias:string[];opcional:boolean;unica:boolean;definicion:string};
export type ModeloDatos={tablas:TablaModelo[];relaciones:RelacionModelo[];generado:string};
export async function leerModeloDatos(db:Pool|Client,contar=true):Promise<ModeloDatos>{
 const tablas=await db.query<{nombre:string;consultable:boolean}>(`SELECT c.relname AS nombre,has_table_privilege(c.oid,'SELECT') AS consultable FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`);
 const columnas=await db.query<{tabla:string;nombre:string;tipo:string;opcional:boolean;primaria:boolean}>(`SELECT c.relname AS tabla,a.attname AS nombre,pg_catalog.format_type(a.atttypid,a.atttypmod) AS tipo,NOT a.attnotnull AS opcional,EXISTS(SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey)) AS primaria FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`);
 const relaciones=await db.query<RelacionModelo>(`SELECT f.conname AS nombre,o.relname AS origen,d.relname AS destino,array_agg(a.attname::text ORDER BY k.orden) AS columnas,array_agg(b.attname::text ORDER BY k.orden) AS referencias,bool_or(NOT a.attnotnull) AS opcional,EXISTS(SELECT 1 FROM pg_catalog.pg_constraint u WHERE u.conrelid=f.conrelid AND u.contype IN ('p','u') AND u.conkey <@ f.conkey) AS unica,pg_catalog.pg_get_constraintdef(f.oid) AS definicion FROM pg_catalog.pg_constraint f JOIN pg_catalog.pg_class o ON o.oid=f.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=o.relnamespace JOIN pg_catalog.pg_class d ON d.oid=f.confrelid CROSS JOIN LATERAL unnest(f.conkey,f.confkey) WITH ORDINALITY k(oa,da,orden) JOIN pg_catalog.pg_attribute a ON a.attrelid=o.oid AND a.attnum=k.oa JOIN pg_catalog.pg_attribute b ON b.attrelid=d.oid AND b.attnum=k.da WHERE f.contype='f' AND n.nspname='public' AND d.relnamespace=n.oid GROUP BY f.oid,f.conname,f.conrelid,f.conkey,o.relname,d.relname ORDER BY o.relname,f.conname`);
 const salida:TablaModelo[]=[];for(const t of tablas.rows){
  let registros:string|null=null;
  if(contar&&t.consultable){try{const nombre='"'+t.nombre.replaceAll('"','""')+'"';registros=String((await db.query<{n:string}>(`SELECT count(*)::text AS n FROM public.${nombre}`)).rows[0].n);}catch{/* El catálogo sigue disponible si el recuento no está autorizado o supera el límite. */}}
  const info=USO_TABLAS[t.nombre];salida.push({...t,...(info??{modulo:'Por revisar',uso:'Sin referencia identificada en el catálogo de uso de esta versión.',fuentes:[]}),conocida:Boolean(info),columnas:columnas.rows.filter(c=>c.tabla===t.nombre).map(({nombre,tipo,opcional,primaria})=>({nombre,tipo,opcional,primaria})),registros});
 }
 return {tablas:salida,relaciones:relaciones.rows,generado:new Date().toISOString()};
}
export function modeloMermaid(modelo:ModeloDatos):string{
 const negocio=modelo.tablas.filter(t=>t.modulo!=='Migraciones'),nombres=new Set(negocio.map(t=>t.nombre));
 const lineas=['erDiagram'];for(const t of negocio){lineas.push(`  ${t.nombre} {`);for(const c of t.columnas){const fk=modelo.relaciones.some(r=>r.origen===t.nombre&&r.columnas.includes(c.nombre));lineas.push(`    ${c.tipo.replace(/[^a-zA-Z0-9_]/g,'_')} ${c.nombre}${c.primaria||fk?' '+[c.primaria?'PK':'',fk?'FK':''].filter(Boolean).join(', '):''}`);}lineas.push('  }');}
 for(const r of modelo.relaciones)if(nombres.has(r.origen)&&nombres.has(r.destino))lineas.push(`  ${r.destino} ${r.opcional?'|o':'||'}--${r.unica?'o|':'o{'} ${r.origen} : "${r.columnas.join(', ')}"`);
 return lineas.join('\n');
}
