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
