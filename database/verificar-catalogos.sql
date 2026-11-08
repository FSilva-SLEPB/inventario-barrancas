BEGIN;

DO $pruebas$
DECLARE
  actor text := 'felipe.silva@slepb.gob.cl';
  tabla text;
  sede_a uuid;
  categoria_id uuid;
  sufijo text := gen_random_uuid()::text;
  nombre_categoria text := 'Categoría de prueba ' || sufijo;
BEGIN
  IF current_user <> 'inventario_app'
     OR EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname = current_user
         AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
     )
     OR has_schema_privilege(current_user, 'public', 'CREATE')
     OR has_table_privilege(current_user, 'public.pgmigrations', 'UPDATE')
  THEN
    RAISE EXCEPTION 'La prueba requiere inventario_app con permisos limitados.';
  END IF;

  FOREACH tabla IN ARRAY ARRAY['sedes', 'dependencias', 'categorias_bienes'] LOOP
    IF NOT has_table_privilege(current_user, format('public.%I', tabla), 'SELECT') THEN
      RAISE EXCEPTION 'Falta SELECT en la tabla de catálogo %.', tabla;
    END IF;
    IF has_table_privilege(current_user, format('public.%I', tabla), 'INSERT')
      OR has_table_privilege(current_user, format('public.%I', tabla), 'UPDATE')
      OR has_table_privilege(current_user, format('public.%I', tabla), 'DELETE')
      OR has_table_privilege(current_user, format('public.%I', tabla), 'TRUNCATE') THEN
      RAISE EXCEPTION 'El rol de la aplicación debe operar los catálogos solo con funciones.';
    END IF;
  END LOOP;

  IF public.guardar_sede_acceso(actor, NULL::uuid, '{"tipo":"establecimiento","nombre":"Sede de prueba A","rbd":null,"direccion":null,"comuna":null,"correoInstitucional":null,"activo":"true"}'::jsonb) ->> 'creada' <> 'true' THEN
    RAISE EXCEPTION 'No se pudo registrar la sede de prueba A.';
  END IF;
  SELECT id INTO sede_a FROM public.sedes WHERE nombre = 'Sede de prueba A';
  IF sede_a IS NULL THEN
    RAISE EXCEPTION 'No se encontró la sede de prueba A.';
  END IF;

  BEGIN
    PERFORM public.guardar_dependencia_acceso(actor, NULL::uuid, sede_a, 'Secretaría', true);
    PERFORM public.guardar_dependencia_acceso(actor, NULL::uuid, sede_a, 'Secretaría', true);
    RAISE EXCEPTION 'Se aceptó una dependencia duplicada en la misma sede.';
  EXCEPTION WHEN SQLSTATE '23505' THEN
    NULL;
  END;

  BEGIN
    PERFORM public.guardar_dependencia_acceso(actor, NULL::uuid, gen_random_uuid(), 'Dependencia sin sede', true);
    RAISE EXCEPTION 'Se aceptó una dependencia con una sede inexistente.';
  EXCEPTION WHEN SQLSTATE '23503' THEN
    NULL;
  END;

  categoria_id := ((public.guardar_categoria_acceso(actor, NULL::uuid, nombre_categoria, true)) ->> 'id')::uuid;
  IF categoria_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo registrar la categoría de prueba.';
  END IF;

  BEGIN
    PERFORM public.guardar_categoria_acceso(actor, NULL::uuid, upper(nombre_categoria), true);
    RAISE EXCEPTION 'Se aceptó una categoría duplicada.';
  EXCEPTION WHEN SQLSTATE '23505' THEN
    NULL;
  END;

  PERFORM public.guardar_categoria_acceso(
    actor,
    categoria_id,
    (SELECT nombre FROM public.categorias_bienes WHERE id = categoria_id),
    false
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.categorias_bienes
    WHERE id = categoria_id AND activo = false
  ) THEN
    RAISE EXCEPTION 'No se pudo desactivar la categoría de prueba.';
  END IF;

  RAISE NOTICE 'Pruebas de catálogos correctas.';
END;
$pruebas$;

ROLLBACK;
