-- Se ejecuta únicamente en el contenedor nuevo de la prueba de recuperación.
BEGIN READ ONLY;

DO $verificar$
DECLARE
  tabla text;
  privilegio text;
BEGIN
  IF current_user <> 'inventario_app' THEN
    RAISE EXCEPTION 'La verificación debe ejecutarse como inventario_app.';
  END IF;
  IF to_regclass('public.equipos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['equipos','equipos_historial','cargas_equipos'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
        OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
        OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
        OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
        OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en las tablas de equipos restauradas';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_equipo_acceso(text,jsonb,integer,text,uuid)','EXECUTE')
      OR NOT has_function_privilege(current_user,'public.cargar_equipos_acceso(text,jsonb,text,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta una función controlada del inventario restaurado';
    END IF;
  END IF;
  IF to_regclass('public.actas_documentos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['actas_contador','actas_documentos','actas_envios'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') THEN RAISE EXCEPTION 'Permisos de actas incorrectos';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.preparar_acta_acceso(text,uuid,uuid,jsonb)','EXECUTE') OR NOT has_function_privilege(current_user,'public.completar_pdf_acta_acceso(text,uuid,bytea)','EXECUTE') OR NOT has_function_privilege(current_user,'public.iniciar_envio_acta_acceso(text,uuid,uuid,text[],text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Faltan funciones controladas de actas';END IF;
  END IF;
  IF to_regclass('public.movimientos_inventario') IS NOT NULL THEN
    IF NOT has_table_privilege(current_user,'public.movimientos_inventario','SELECT') OR has_table_privilege(current_user,'public.movimientos_inventario','INSERT') OR has_table_privilege(current_user,'public.movimientos_inventario','UPDATE') OR has_table_privilege(current_user,'public.movimientos_inventario','DELETE') THEN RAISE EXCEPTION 'Permisos de movimientos incorrectos';END IF;
    IF NOT has_function_privilege(current_user,'public.mover_bien_acceso(text,uuid,jsonb)','EXECUTE') OR has_function_privilege(current_user,'public.guardar_celular_ficha_base(text,uuid,jsonb,integer,text)','EXECUTE') OR has_function_privilege(current_user,'public.guardar_equipo_ficha_base(text,jsonb,integer,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Funciones controladas de custodia incorrectas';END IF;
  END IF;
  IF to_regclass('public.celulares') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['celulares','celulares_historial'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en celulares restaurados';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_celular_acceso(text,uuid,jsonb,integer,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la función controlada de celulares restaurada';
    END IF;
  END IF;
  IF to_regclass('public.funcionarios_nc') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['funcionarios_nc','funcionarios_nc_historial'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en funcionarios restaurados';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la función controlada de funcionarios restaurada';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.funcionarios_nc_historial'::regclass AND contype='f' AND convalidated AND confrelid='public.funcionarios_nc'::regclass) THEN
      RAISE EXCEPTION 'Falta la relación de funcionarios e historial';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.directorio_sedes') AND attname='nombres' AND NOT attisdropped) THEN
    IF NOT has_function_privilege(current_user,'public.guardar_sede_directorio_acceso(text,uuid,jsonb,text,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la escritura controlada del directorio de sedes restaurado';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'El usuario de aplicación tiene privilegios administrativos.';
  END IF;
  IF has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'El usuario de aplicación puede crear objetos en public.';
  END IF;
  IF has_database_privilege(current_user, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'El usuario de aplicación puede crear esquemas en la base.';
  END IF;

  FOREACH tabla IN ARRAY ARRAY['sedes', 'dependencias', 'categorias_bienes'] LOOP
    IF to_regclass(format('public.%I', tabla)) IS NULL THEN
      RAISE EXCEPTION 'Falta una tabla del catálogo restaurado.';
    END IF;
    FOREACH privilegio IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
      IF NOT has_table_privilege(current_user, format('public.%I', tabla), privilegio) THEN
        RAISE EXCEPTION 'Falta un permiso requerido del usuario de aplicación.';
      END IF;
    END LOOP;
    IF has_table_privilege(current_user, format('public.%I', tabla), 'DELETE')
        OR has_table_privilege(current_user, format('public.%I', tabla), 'TRUNCATE') THEN
      RAISE EXCEPTION 'El usuario de aplicación tiene permisos de borrado.';
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dependencias'::regclass
      AND conname = 'dependencias_sede_id_fkey' AND contype = 'f' AND convalidated
      AND confrelid = 'public.sedes'::regclass
  ) THEN
    RAISE EXCEPTION 'Falta la relación validada entre dependencias y sedes.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = to_regclass('public.dependencias_sede_nombre_unico')
      AND indisunique AND indisvalid
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = to_regclass('public.categorias_bienes_nombre_unico')
      AND indisunique AND indisvalid
  ) THEN
    RAISE EXCEPTION 'Falta un índice único requerido en los catálogos.';
  END IF;
END;
$verificar$;

-- En CI se comprueba también que los datos ficticios sobrevivieron a la copia.
\if :validar_datos_ci
DO $datos_ci$
BEGIN
  IF to_regclass('public.actas_documentos') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.actas_documentos a JOIN public.actas_envios e ON e.acta_id=a.id
      WHERE a.id='80000000-0000-4000-8000-000000000001' AND a.movimiento_id='70000000-0000-4000-8000-000000000001'
       AND a.folio=(a.datos->>'folio')::bigint AND a.version=1 AND octet_length(a.pdf)>100 AND a.sha256=encode(sha256(a.pdf),'hex')
       AND a.datos->'metadata'->>'entregaNombre'='Persona ficticia de entrega' AND a.datos->'metadata'->>'recibeCorreo'='persona@example.org'
       AND e.id='90000000-0000-4000-8000-000000000001' AND e.estado='fallido' AND e.resultado->>'codigo'='SIMULADO_SIN_ENVIO') THEN RAISE EXCEPTION 'No se recuperaron el PDF, folio, datos e historial de envío del acta ficticia';END IF;
    IF (SELECT ultimo FROM public.actas_contador)<(SELECT max(folio) FROM public.actas_documentos) THEN RAISE EXCEPTION 'El contador restaurado no conserva los folios';END IF;
  END IF;
  IF to_regclass('public.movimientos_inventario') IS NOT NULL THEN
    IF (SELECT count(*) FROM public.movimientos_inventario WHERE id IN('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002') AND accion='devolucion' AND antes->>'custodia'='asignado' AND despues->>'custodia'='en_bodega')<>2 OR NOT EXISTS(SELECT 1 FROM public.equipos e JOIN public.equipos_historial h ON h.equipo_id=e.id WHERE h.movimiento_id='70000000-0000-4000-8000-000000000001' AND e.custodia='en_bodega' AND e.version=2) OR NOT EXISTS(SELECT 1 FROM public.celulares c JOIN public.celulares_historial h ON h.celular_id=c.id WHERE h.movimiento_id='70000000-0000-4000-8000-000000000002' AND c.custodia='en_bodega' AND c.version=2) THEN RAISE EXCEPTION 'No se recuperaron custodia, movimientos e historial de ambos tipos de bien';END IF;
  END IF;
  IF to_regclass('public.equipos') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.equipos e JOIN public.equipos_historial h ON h.equipo_id=e.id
      WHERE e.serie='CI-RECUPERACION-SERIE-001' AND e.numero_inventario='CI-RECUPERACION-INV-001'
        AND e.sede_id='10000000-0000-4000-8000-000000000001'
        AND h.actor='felipe.silva@slepb.gob.cl' AND h.antes IS NULL
        AND h.despues->>'serie'=e.serie
    ) THEN
      RAISE EXCEPTION 'No se recuperó el equipo ficticio y su historial';
    END IF;
  END IF;
  IF to_regclass('public.funcionarios_nc') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.funcionarios_nc f JOIN public.funcionarios_nc_historial h ON h.funcionario_id=f.id
     WHERE f.id='40000000-0000-4000-8000-000000000001' AND f.nombre='Persona ficticia O''Higgins'
      AND NOT f.activo AND f.fecha_ingreso=DATE '2026-10-30' AND f.rut IS NULL AND f.correo IS NULL
      AND h.antes IS NULL AND h.despues->>'nombre'=f.nombre AND h.actor='felipe.silva@slepb.gob.cl') THEN
      RAISE EXCEPTION 'No se recuperó la ficha ficticia y su historial';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.directorio_sedes') AND attname='nombres' AND NOT attisdropped) THEN
    IF NOT EXISTS(SELECT 1 FROM public.directorio_sedes d JOIN public.directorio_historial h ON h.sede_id=d.sede_id
      WHERE d.sede_id='50000000-0000-4000-8000-000000000001' AND d.nombres='Ana María' AND d.apellidos='O''Higgins de Ejemplo'
       AND d.nombre='Ana María O''Higgins de Ejemplo' AND d.situacion='subrogante' AND h.despues->>'apellidos'=d.apellidos) THEN
      RAISE EXCEPTION 'No se recuperó el directorio ficticio con nombres, apellidos e historial';
    END IF;
  END IF;
  IF to_regclass('public.celulares') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.celulares c JOIN public.celulares_historial h ON h.celular_id=c.id
     WHERE c.id='60000000-0000-4000-8000-000000000001' AND c.telefono='+56900000001' AND c.numero_inventario='CI-CELULAR-001'
      AND c.activo AND h.antes IS NULL AND h.despues->>'telefono'=c.telefono AND h.actor='felipe.silva@slepb.gob.cl') THEN
      RAISE EXCEPTION 'No se recuperó el celular ficticio con su número e historial';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sedes
    WHERE id = '10000000-0000-4000-8000-000000000001'
      AND nombre = 'Sede de prueba de recuperación' AND tipo = 'nivel_central'
      AND rbd IS NULL AND activo
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dependencias
    WHERE id = '20000000-0000-4000-8000-000000000001'
      AND sede_id = '10000000-0000-4000-8000-000000000001'
      AND nombre = 'Dirección O''Higgins' AND NOT activo
  ) OR NOT EXISTS (
    SELECT 1 FROM public.categorias_bienes
    WHERE id = '30000000-0000-4000-8000-000000000001'
      AND nombre = 'Equipos de prueba de respaldo' AND activo
  ) THEN
    RAISE EXCEPTION 'Los datos ficticios no se recuperaron correctamente.';
  END IF;
END;
$datos_ci$;
\endif

SELECT
  (SELECT count(*) FROM public.sedes) AS sedes,
  (SELECT count(*) FROM public.dependencias) AS dependencias,
  (SELECT count(*) FROM public.categorias_bienes) AS categorias;

ROLLBACK;
