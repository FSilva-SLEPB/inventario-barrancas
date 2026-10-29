\set ON_ERROR_STOP on
-- Solo sobre una base de pruebas. Todos los cambios se revierten al terminar.
BEGIN;
DO $pruebas$
DECLARE
  actor text;
  prueba text := 'usuario-prueba-' || txid_current() || '@slepb.gob.cl';
  otro_admin text := 'admin-prueba-' || txid_current() || '@slepb.gob.cl';
  cambios bigint;
BEGIN
  SELECT correo INTO actor FROM public.usuarios_acceso WHERE activo AND rol = 'administrador' ORDER BY correo LIMIT 1;
  IF actor IS NULL THEN RAISE EXCEPTION 'Se necesita un administrador inicial'; END IF;
  IF (SELECT count(*) FROM public.usuarios_acceso WHERE activo AND rol = 'administrador') <> 1 THEN
    RAISE EXCEPTION 'Usar una base temporal con un único administrador inicial';
  END IF;
  BEGIN
    PERFORM public.guardar_usuario_acceso(actor, actor, '', 'consulta', true,
      (SELECT version FROM public.usuarios_acceso WHERE correo = actor));
    RAISE EXCEPTION 'Se permitió retirar al último administrador';
  EXCEPTION WHEN SQLSTATE 'P1001' THEN NULL;
  END;
  PERFORM public.guardar_usuario_acceso(actor, prueba, 'Usuario ficticio', 'consulta', true, 0);
  BEGIN
    PERFORM public.guardar_usuario_acceso(prueba, otro_admin, '', 'administrador', true, 0);
    RAISE EXCEPTION 'Una cuenta de consulta pudo conceder permisos';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.guardar_usuario_acceso(actor, prueba, '', 'administrador', true, 0);
    RAISE EXCEPTION 'Se permitió duplicar un correo';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.guardar_usuario_acceso(actor, 'externo@gmail.com', '', 'consulta', true, 0);
    RAISE EXCEPTION 'Se permitió un correo externo';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    PERFORM public.guardar_usuario_acceso(actor, otro_admin, '', 'perfil_inventado', true, 0);
    RAISE EXCEPTION 'Se permitió un perfil desconocido';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  PERFORM public.guardar_usuario_acceso(actor, prueba, 'Nombre actualizado', 'consulta', false, 1);
  BEGIN
    PERFORM public.guardar_usuario_acceso(actor, prueba, '', 'consulta', true, 1);
    RAISE EXCEPTION 'Una edición obsoleta sobrescribió un cambio';
  EXCEPTION WHEN SQLSTATE 'P1003' THEN NULL;
  END;
  BEGIN
    PERFORM public.guardar_usuario_acceso(prueba, otro_admin, '', 'consulta', true, 0);
    RAISE EXCEPTION 'Un actor inactivo pudo conceder accesos';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM public.guardar_usuario_acceso(actor, otro_admin, 'Administrador ficticio', 'administrador', true, 0);
  BEGIN
    PERFORM public.guardar_usuario_acceso(otro_admin, otro_admin, '', 'consulta', true, 1);
    RAISE EXCEPTION 'Se permitió retirar el propio permiso';
  EXCEPTION WHEN SQLSTATE 'P1002' THEN NULL;
  END;
  SELECT count(*) INTO cambios FROM public.usuarios_acceso WHERE correo IN (prueba, otro_admin);
  IF cambios <> 2 THEN RAISE EXCEPTION 'No se guardaron los usuarios de prueba'; END IF;
  IF has_table_privilege(current_user, 'public.usuarios_acceso', 'UPDATE')
    OR has_table_privilege(current_user, 'public.usuarios_acceso_historial', 'INSERT')
    OR has_table_privilege(current_user, 'public.usuarios_acceso_historial', 'DELETE') THEN
    RAISE EXCEPTION 'La cuenta web puede evitar la función controlada o alterar el historial';
  END IF;
  RAISE NOTICE 'Usuarios, perfiles, duplicados, concurrencia y último administrador verificados';
END;
$pruebas$;
ROLLBACK;
