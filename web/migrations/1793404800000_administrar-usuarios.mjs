export function up(pgm) {
  pgm.sql(`
ALTER TABLE public.usuarios_acceso
  ADD CONSTRAINT usuarios_correo_longitud CHECK (length(correo) <= 254),
  ADD COLUMN nombre text NOT NULL DEFAULT '' CHECK (
    nombre = btrim(nombre) AND length(nombre) <= 120 AND nombre !~ '[[:cntrl:]]'
  ),
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE public.usuarios_acceso_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor text NOT NULL,
  correo text NOT NULL,
  antes jsonb,
  despues jsonb NOT NULL,
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.usuarios_acceso_historial FROM PUBLIC, inventario_app;

CREATE FUNCTION public.guardar_usuario_acceso(
  p_actor text, p_correo text, p_nombre text, p_rol text,
  p_activo boolean, p_version integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $funcion$
DECLARE
  anterior public.usuarios_acceso%ROWTYPE;
  posterior public.usuarios_acceso%ROWTYPE;
BEGIN
  -- Serializar todos los cambios de permisos, incluida la comprobación del actor.
  PERFORM pg_advisory_xact_lock(1793404800000);
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios_acceso
    WHERE correo = p_actor AND activo AND rol = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_correo IS NULL OR p_nombre IS NULL OR p_activo IS NULL OR p_version IS NULL
      OR p_version < 0 OR p_rol IS NULL OR p_rol NOT IN ('administrador', 'consulta') THEN
    RAISE EXCEPTION 'Datos de usuario inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO anterior FROM public.usuarios_acceso WHERE correo = p_correo FOR UPDATE;
  IF p_version = 0 THEN
    IF FOUND THEN
      RAISE EXCEPTION 'Correo ya registrado' USING ERRCODE = '23505';
    END IF;
    INSERT INTO public.usuarios_acceso (correo, nombre, rol, activo)
    VALUES (p_correo, p_nombre, p_rol, p_activo) RETURNING * INTO posterior;
  ELSE
    IF NOT FOUND OR anterior.version <> p_version THEN
      RAISE EXCEPTION 'La cuenta cambió; recargar' USING ERRCODE = 'P1003';
    END IF;
    IF anterior.activo AND anterior.rol = 'administrador'
        AND (NOT p_activo OR p_rol <> 'administrador') THEN
      IF (SELECT count(*) FROM public.usuarios_acceso WHERE activo AND rol = 'administrador') <= 1 THEN
        RAISE EXCEPTION 'Debe quedar un administrador activo' USING ERRCODE = 'P1001';
      END IF;
      IF p_correo = p_actor THEN
        RAISE EXCEPTION 'No puedes retirar tu propio permiso' USING ERRCODE = 'P1002';
      END IF;
    END IF;
    UPDATE public.usuarios_acceso
    SET nombre = p_nombre, rol = p_rol, activo = p_activo,
        version = version + 1, actualizado_en = CURRENT_TIMESTAMP
    WHERE correo = p_correo RETURNING * INTO posterior;
  END IF;
  INSERT INTO public.usuarios_acceso_historial (actor, correo, antes, despues)
  VALUES (p_actor, p_correo, CASE WHEN p_version = 0 THEN NULL ELSE to_jsonb(anterior) END,
          to_jsonb(posterior));
END;
$funcion$;
REVOKE ALL ON FUNCTION public.guardar_usuario_acceso(text, text, text, text, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_usuario_acceso(text, text, text, text, boolean, integer) TO inventario_app;
  `);
}

export const down = false;
