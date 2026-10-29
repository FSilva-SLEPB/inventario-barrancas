\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_acceso
    WHERE correo = 'felipe.silva@slepb.gob.cl' AND rol = 'administrador' AND activo
  ) THEN
    RAISE EXCEPTION 'No se preparó la cuenta de administración inicial';
  END IF;
  IF NOT has_table_privilege(current_user, 'public.usuarios_acceso', 'SELECT') THEN
    RAISE EXCEPTION 'La aplicación necesita consultar permisos';
  END IF;
  IF has_table_privilege(current_user, 'public.usuarios_acceso', 'INSERT')
     OR has_table_privilege(current_user, 'public.usuarios_acceso', 'UPDATE')
     OR has_table_privilege(current_user, 'public.usuarios_acceso', 'DELETE')
     OR has_table_privilege(current_user, 'public.usuarios_acceso', 'TRUNCATE') THEN
    RAISE EXCEPTION 'La aplicación no debe poder conceder permisos';
  END IF;
  RAISE NOTICE 'Cuenta inicial y permisos de lectura de acceso verificados';
END $$;
ROLLBACK;
