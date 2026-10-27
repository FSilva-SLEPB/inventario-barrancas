BEGIN;

DO $pruebas$
DECLARE
  sede_a uuid := gen_random_uuid();
  sede_b uuid := gen_random_uuid();
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

  INSERT INTO public.sedes (id, tipo, nombre)
  VALUES
    (sede_a, 'establecimiento', 'Sede de prueba A ' || sufijo),
    (sede_b, 'establecimiento', 'Sede de prueba B ' || sufijo);

  INSERT INTO public.dependencias (sede_id, nombre)
  VALUES (sede_a, 'Secretaría'), (sede_b, 'Secretaría');

  BEGIN
    INSERT INTO public.dependencias (sede_id, nombre)
    VALUES (sede_a, 'SECRETARÍA');
    RAISE EXCEPTION 'Se aceptó una dependencia duplicada en la misma sede.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.dependencias (sede_id, nombre)
    VALUES (gen_random_uuid(), 'Dependencia sin sede');
    RAISE EXCEPTION 'Se aceptó una dependencia con una sede inexistente.';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  INSERT INTO public.categorias_bienes (nombre)
  VALUES (nombre_categoria)
  RETURNING id INTO categoria_id;

  BEGIN
    INSERT INTO public.categorias_bienes (nombre)
    VALUES (upper(nombre_categoria));
    RAISE EXCEPTION 'Se aceptó una categoría duplicada.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  UPDATE public.categorias_bienes SET activo = false WHERE id = categoria_id;

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
