export function up(pgm) {
  pgm.sql(`
ALTER TABLE public.usuarios_acceso
  DROP CONSTRAINT usuarios_acceso_rol_check,
  ADD CONSTRAINT usuarios_acceso_rol_check CHECK (
    rol IN ('administrador', 'administrador_gestion', 'encargado', 'consulta', 'consulta_sede')
  ),
  ADD COLUMN sede_id uuid REFERENCES public.sedes(id) ON DELETE RESTRICT,
  ADD CONSTRAINT usuarios_alcance_check CHECK (
    (rol IN ('encargado', 'consulta_sede') AND sede_id IS NOT NULL)
    OR (rol NOT IN ('encargado', 'consulta_sede') AND sede_id IS NULL)
  );
CREATE INDEX usuarios_acceso_sede_idx ON public.usuarios_acceso(sede_id);

CREATE FUNCTION public.guardar_usuario_acceso(
  p_actor text, p_correo text, p_nombre text, p_rol text,
  p_activo boolean, p_version integer, p_sede uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $funcion$
DECLARE
  actor_rol text;
  anterior public.usuarios_acceso%ROWTYPE;
  posterior public.usuarios_acceso%ROWTYPE;
  existe boolean;
BEGIN
  -- Mismo bloqueo que la versión anterior; revalidar al actor tras adquirirlo.
  PERFORM pg_advisory_xact_lock(1793404800000);
  SELECT rol INTO actor_rol FROM public.usuarios_acceso
  WHERE correo = p_actor AND activo;
  IF actor_rol IS NULL OR actor_rol NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_correo IS NULL OR p_nombre IS NULL OR p_activo IS NULL OR p_version IS NULL
      OR p_version < 0 OR p_rol IS NULL
      OR p_rol NOT IN ('administrador', 'administrador_gestion', 'encargado', 'consulta', 'consulta_sede') THEN
    RAISE EXCEPTION 'Datos de usuario inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO anterior FROM public.usuarios_acceso WHERE correo = p_correo FOR UPDATE;
  existe := FOUND;
  IF actor_rol <> 'administrador' AND (
    p_rol IN ('administrador', 'administrador_gestion')
    OR (existe AND anterior.rol IN ('administrador', 'administrador_gestion'))
  ) THEN
    RAISE EXCEPTION 'Perfil reservado al administrador del sistema' USING ERRCODE = 'P1004';
  END IF;
  IF p_rol IN ('encargado', 'consulta_sede') THEN
    PERFORM 1 FROM public.sedes WHERE id = p_sede AND activo
      AND tipo IN ('establecimiento', 'jardin_infantil') FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Se requiere una sede EE/JI activa' USING ERRCODE = 'P1005';
    END IF;
  ELSIF p_sede IS NOT NULL THEN
    RAISE EXCEPTION 'Perfil global sin sede' USING ERRCODE = 'P1005';
  END IF;
  IF p_version = 0 THEN
    IF existe THEN RAISE EXCEPTION 'Correo ya registrado' USING ERRCODE = '23505'; END IF;
    INSERT INTO public.usuarios_acceso (correo, nombre, rol, activo, sede_id)
    VALUES (p_correo, p_nombre, p_rol, p_activo, p_sede) RETURNING * INTO posterior;
  ELSE
    IF NOT existe OR anterior.version <> p_version THEN
      RAISE EXCEPTION 'La cuenta cambió; recargar' USING ERRCODE = 'P1003';
    END IF;
    IF anterior.activo AND anterior.rol = 'administrador'
        AND (NOT p_activo OR p_rol <> 'administrador') THEN
      IF (SELECT count(*) FROM public.usuarios_acceso WHERE activo AND rol = 'administrador') <= 1 THEN
        RAISE EXCEPTION 'Debe quedar un administrador del sistema activo' USING ERRCODE = 'P1001';
      END IF;
      IF p_correo = p_actor THEN
        RAISE EXCEPTION 'No puedes retirar tu propio permiso' USING ERRCODE = 'P1002';
      END IF;
    END IF;
    UPDATE public.usuarios_acceso
    SET nombre = p_nombre, rol = p_rol, activo = p_activo, sede_id = p_sede,
        version = version + 1, actualizado_en = CURRENT_TIMESTAMP
    WHERE correo = p_correo RETURNING * INTO posterior;
  END IF;
  INSERT INTO public.usuarios_acceso_historial (actor, correo, antes, despues)
  VALUES (p_actor, p_correo, CASE WHEN p_version = 0 THEN NULL ELSE to_jsonb(anterior) END,
          to_jsonb(posterior));
END;
$funcion$;
REVOKE ALL ON FUNCTION public.guardar_usuario_acceso(text, text, text, text, boolean, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_usuario_acceso(text, text, text, text, boolean, integer, uuid) TO inventario_app;

-- Compatibilidad de llamadas anteriores: delega en las mismas validaciones,
-- sin proporcionar una vía alternativa para conceder perfiles o saltar el alcance.
CREATE OR REPLACE FUNCTION public.guardar_usuario_acceso(
  p_actor text, p_correo text, p_nombre text, p_rol text,
  p_activo boolean, p_version integer
) RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $funcion$
  SELECT public.guardar_usuario_acceso(p_actor, p_correo, p_nombre, p_rol, p_activo, p_version, NULL::uuid);
$funcion$;

CREATE FUNCTION public.guardar_dependencia_acceso(
  p_actor text, p_id uuid, p_sede uuid, p_nombre text, p_activo boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $funcion$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  sede_anterior uuid;
BEGIN
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR actor.rol NOT IN ('administrador', 'administrador_gestion', 'encargado') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_activo IS NULL OR p_nombre IS NULL OR length(p_nombre) NOT BETWEEN 1 AND 200
      OR p_nombre <> btrim(p_nombre) OR p_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF actor.rol = 'encargado' THEN
    PERFORM 1 FROM public.sedes WHERE id = actor.sede_id AND activo
      AND tipo IN ('establecimiento', 'jardin_infantil') FOR SHARE;
    IF NOT FOUND OR p_sede IS DISTINCT FROM actor.sede_id THEN
      RAISE EXCEPTION 'Sede fuera del alcance' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.dependencias (sede_id, nombre, activo) VALUES (p_sede, p_nombre, p_activo);
  ELSE
    SELECT sede_id INTO sede_anterior FROM public.dependencias WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dependencia no disponible' USING ERRCODE = 'P1006'; END IF;
    IF actor.rol = 'encargado' AND sede_anterior IS DISTINCT FROM actor.sede_id THEN
      RAISE EXCEPTION 'Dependencia fuera del alcance' USING ERRCODE = '42501';
    END IF;
    UPDATE public.dependencias SET sede_id = p_sede, nombre = p_nombre, activo = p_activo WHERE id = p_id;
  END IF;
END;
$funcion$;
REVOKE ALL ON FUNCTION public.guardar_dependencia_acceso(text, uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_dependencia_acceso(text, uuid, uuid, text, boolean) TO inventario_app;
  `);
}

export const down = false;
