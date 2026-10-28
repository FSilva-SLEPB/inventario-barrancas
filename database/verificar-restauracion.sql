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
