import type {Pool,Client} from 'pg';
export const USO_TABLAS:Record<string,{modulo:string;uso:string;fuentes:string[]}>={
 rbac_permisos:{modulo:'Acceso',uso:'Acciones existentes por recurso.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 rbac_perfiles:{modulo:'Acceso',uso:'Perfiles configurables, clasificación protegida, alcances, vigencia y versión.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 rbac_perfil_permisos:{modulo:'Acceso',uso:'Permisos efectivos de cada perfil.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 rbac_limites_perfiles:{modulo:'Acceso',uso:'Límites protegidos de los perfiles predefinidos.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 rbac_historial:{modulo:'Acceso',uso:'Auditoría inmutable de perfiles, cuentas, vínculos y correcciones.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 rbac_anteriores:{modulo:'Acceso',uso:'Compatibilidad explícita de perfiles anteriores sin reasignar usuarios.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 asignaciones_funcionarios:{modulo:'Acceso',uso:'Vínculos explícitos del equipamiento con su funcionario; vigencia e historial.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},
 correcciones_personales:{modulo:'Acceso',uso:'Solicitud de corrección propia y resolución autorizada con versión.',fuentes:['src/lib/perfiles.ts','migrations/1796140800000_rbac-perfiles.cjs']},

 reportes_incidentes_inventario:{modulo:'Incidentes',uso:'Borrador, envío y validación TI de robo, sustracción o daño; parte y denunciante, selección y versiones, sin cambiar estados hasta validar.',fuentes:['migrations/1796054400000_reportes-incidentes-ti.cjs','src/lib/reportes-incidentes.ts']},
 reportes_incidentes_operaciones:{modulo:'Incidentes',uso:'Operaciones idempotentes y auditoría de guardar, enviar y resolver, con actor y solicitud original.',fuentes:['migrations/1796054400000_reportes-incidentes-ti.cjs']},
 reportes_incidentes_adjuntos:{modulo:'Incidentes',uso:'Denuncia o informe privado persistente por reporte, autor y bytes originales; se puede aportar después del envío.',fuentes:['src/app/api/inventario/incidentes/adjuntos/route.ts']},
 operaciones_inventario:{modulo:'Movimientos',uso:'Cambio con grupos devueltos y reemplazos, o traspaso entre sedes; ruta real directa educativa o vía Bodega TI, solicitud y procedencia inmutables.',fuentes:['migrations/1794787200000_operaciones-compuestas-inventario.mjs','src/lib/operaciones-inventario.ts']},
 operaciones_inventario_detalle:{modulo:'Movimientos',uso:'Vincula cada movimiento de devolución/entrega a su operación y acta compartida, sin duplicar documentos.',fuentes:['migrations/1794787200000_operaciones-compuestas-inventario.mjs']},
 actas_contador:{modulo:'Actas',uso:'Secuencia única de folios, comenzando en 0; imprimir y reenviar no consumen otro número.',fuentes:['migrations/1794355200000_actas-documentos-correo.mjs']},
 actas_documentos:{modulo:'Actas',uso:'Acta de movimiento, entrega histórica u operación compuesta (una sola fuente), con folio, datos de la emisión y PDF conservado con su huella SHA-256.',fuentes:['src/lib/actas.ts','src/lib/pdf-actas.ts']},
 actas_envios:{modulo:'Actas',uso:'Intentos y resultados de envío por correo del mismo PDF, con destinatarios, actor e idempotencia.',fuentes:['src/app/inventario/actas/acciones.ts','src/lib/correo-actas.ts']},
 cambios_estados_activo:{modulo:'Estados del activo',uso:'Transiciones administrativas y de condición confirmadas por UTIC, con solicitud idempotente, versión e instantáneas inmutables.',fuentes:['src/app/inventario/estados-acciones.ts','migrations/1794873600000_estados-activos-integrados.mjs']},
 prestamos_inventario:{modulo:'Préstamos',uso:'Préstamos temporales desde Bodega TI, pertenencia conservada, destino y plazo, devolución vinculada e historial en movimientos.',fuentes:['src/lib/prestamos.ts','migrations/1794700800000_prestamos-inventario.mjs']},
 movimientos_inventario:{modulo:'Movimientos',uso:'Asignaciones, devoluciones, préstamos y traspasos directos de equipos y celulares, con fecha, receptor, idempotencia e instantáneas.',fuentes:['src/lib/inventario-bodega.ts','migrations/1794268800000_custodia-movimientos-inventario.mjs']},
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
 equipos:{modulo:'Equipos',uso:'Identidad estable del bien, sede, categoría, funcionamiento, custodia en Bodega TI/asignado/en préstamo y situación de entrega.',fuentes:['src/lib/equipos.ts','src/lib/entregas.ts','src/lib/robos.ts']},
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
 ubicaciones_bodega:{modulo:'Bodega TI',uso:'Cinco ubicaciones físicas compartidas por los inventarios; no sustituyen sede, custodia ni estados.',fuentes:['src/lib/ubicaciones-bodega.ts']},
 ubicaciones_bodega_historial:{modulo:'Bodega TI',uso:'Confirmaciones de ubicación física con actor, versión e instantáneas; conserva pertenencia y estados.',fuentes:['migrations/1795622400000_ubicaciones-bodega-ti.mjs']},
 insumos_historial:{modulo:'Insumos',uso:'Historial de catálogo, fotos e ingresos de stock con actor, solicitud idempotente e instantáneas.',fuentes:['migrations/1795536000000_auditoria-estados-insumos.mjs']},
 fotografias_sedes:{modulo:'Sedes',uso:'Fotografías de establecimientos y jardines, versiones persistentes con autor y permisos por sede.',fuentes:['src/app/api/sedes/foto/route.ts','migrations/1795881600000_fotografias-sedes.mjs']},
 imagenes_insumos:{modulo:'Insumos',uso:'Fotografías de catálogo persistidas en PostgreSQL, con tipo, bytes y autor; incluidas en los respaldos.',fuentes:['src/app/api/insumos/imagen/route.ts','migrations/1795536000000_auditoria-estados-insumos.mjs']},
 categorias_insumos_codigos:{modulo:'Insumos',uso:'Prefijos únicos y correlativos por categoría para códigos automáticos de productos nuevos.',fuentes:['migrations/1795708800000_compras-insumos-oc.mjs']},
 ingresos_insumos:{modulo:'Insumos',uso:'Compras por producto, cantidad, OC y fecha con instantánea; conserva saldos anteriores sin inventar documentos.',fuentes:['src/app/mantenedores/insumos/acciones.ts']},
 catalogo_insumos:{modulo:'Insumos',uso:'Catálogo de insumos solicitables (código, nombre, categoría, unidad, foto y vigencia).',fuentes:['src/lib/insumos.ts','migrations/1795100000000_insumos-catalogo-stock-solicitudes.mjs']},
 stock_insumos:{modulo:'Insumos',uso:'Existencia y reserva disponible por producto del catálogo de insumos.',fuentes:['src/lib/insumos.ts','migrations/1795100000000_insumos-catalogo-stock-solicitudes.mjs']},
 solicitudes_insumos:{modulo:'Insumos',uso:'Solicitudes de insumos por sede con datos del solicitante, estado, validación/aprobación, entrega o cancelación.',fuentes:['src/lib/insumos.ts','src/app/insumos/acciones.ts','migrations/1795100000000_insumos-catalogo-stock-solicitudes.mjs']},
 solicitudes_insumos_detalle:{modulo:'Insumos',uso:'Líneas solicitadas/aprobadas/entregadas de cada solicitud de insumos.',fuentes:['src/lib/insumos.ts','migrations/1795100000000_insumos-catalogo-stock-solicitudes.mjs']},
 reservas_insumos:{modulo:'Insumos',uso:'Reservas de stock asociadas a solicitudes aprobadas y su consumo al entregar.',fuentes:['migrations/1795200000000_insumos-flujo-validacion-fotos.mjs','migrations/1795400000000_insumos-acta-entrega-completo.mjs']},
 entregas_insumos:{modulo:'Insumos',uso:'Registro de entregas contra solicitud de insumos, receptor y acta asociada.',fuentes:['src/lib/insumos.ts','migrations/1795400000000_insumos-acta-entrega-completo.mjs']},
 entregas_insumos_detalle:{modulo:'Insumos',uso:'Detalle de productos y cantidades entregadas en cada entrega de insumos.',fuentes:['src/lib/insumos.ts','migrations/1795400000000_insumos-acta-entrega-completo.mjs']},
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
