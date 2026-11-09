export function up(pgm) {
  pgm.sql(`
CREATE OR REPLACE FUNCTION public.guardar_sede_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  anterior public.sedes%ROWTYPE;
  nuevo_id uuid;
  v_tipo text := p_datos->>'tipo';
  v_nombre text := p_datos->>'nombre';
  v_rbd text := p_datos->>'rbd';
  v_direccion text := p_datos->>'direccion';
  v_comuna text := p_datos->>'comuna';
  v_correo text := p_datos->>'correoInstitucional';
  v_activo text := p_datos->>'activo';
BEGIN
  PERFORM pg_advisory_xact_lock(1793059200000);
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR actor.rol NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_datos IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR v_tipo IS NULL OR v_nombre IS NULL OR v_activo IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF length(v_nombre) > 200 OR btrim(v_nombre) <> v_nombre OR v_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_tipo NOT IN ('nivel_central', 'establecimiento', 'jardin_infantil') THEN
    RAISE EXCEPTION 'Tipo de sede no reconocido' USING ERRCODE = '22023';
  END IF;
  IF v_tipo = 'nivel_central' AND v_rbd IS NOT NULL THEN
    RAISE EXCEPTION 'Nivel Central debe registrarse sin RBD' USING ERRCODE = '22023';
  END IF;
  IF v_rbd IS NOT NULL AND (length(v_rbd) > 30 OR btrim(v_rbd) <> v_rbd OR v_rbd ~ '[[:cntrl:]]' OR v_rbd = '') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_direccion IS NOT NULL AND (length(v_direccion) > 250 OR btrim(v_direccion) <> v_direccion OR v_direccion ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_comuna IS NOT NULL AND (length(v_comuna) > 100 OR btrim(v_comuna) <> v_comuna OR v_comuna ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_correo IS NOT NULL AND (length(v_correo) > 254 OR v_correo !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_activo !~ '^(true|false)$' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.sedes (tipo, nombre, rbd, direccion, comuna, correo_institucional, activo)
    VALUES (v_tipo, v_nombre, NULLIF(btrim(v_rbd), ''), NULLIF(btrim(v_direccion), ''), NULLIF(btrim(v_comuna), ''), NULLIF(lower(btrim(v_correo)), ''), v_activo = 'true')
    RETURNING id INTO nuevo_id;
    RETURN jsonb_build_object('id', nuevo_id, 'creada', true);
  END IF;

  SELECT * INTO anterior FROM public.sedes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sede no disponible' USING ERRCODE = 'P1006';
  END IF;
  UPDATE public.sedes
     SET tipo = v_tipo, nombre = v_nombre, rbd = NULLIF(btrim(v_rbd), ''),
         direccion = NULLIF(btrim(v_direccion), ''), comuna = NULLIF(btrim(v_comuna), ''),
         correo_institucional = NULLIF(lower(btrim(v_correo)), ''), activo = (v_activo = 'true')
   WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'creada', false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_sede_acceso(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_sede_acceso(text, uuid, jsonb) TO inventario_app;

CREATE OR REPLACE FUNCTION public.guardar_categoria_acceso(p_actor text, p_id uuid, p_nombre text, p_activo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $fn$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  nuevo_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(1793059200000);
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR actor.rol NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_activo IS NULL OR p_nombre IS NULL OR length(p_nombre) NOT BETWEEN 1 AND 100
      OR p_nombre <> btrim(p_nombre) OR p_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.categorias_bienes (nombre, activo) VALUES (p_nombre, p_activo) RETURNING id INTO nuevo_id;
    RETURN jsonb_build_object('id', nuevo_id, 'creada', true);
  END IF;
  UPDATE public.categorias_bienes SET nombre = p_nombre, activo = p_activo WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no disponible' USING ERRCODE = 'P1006';
  END IF;
  RETURN jsonb_build_object('id', p_id, 'creada', false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_categoria_acceso(text, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_categoria_acceso(text, uuid, text, boolean) TO inventario_app;

REVOKE ALL ON TABLE public.sedes, public.dependencias, public.categorias_bienes FROM PUBLIC, inventario_app;
GRANT SELECT ON TABLE public.sedes TO inventario_app;
GRANT SELECT ON TABLE public.dependencias TO inventario_app;
GRANT SELECT ON TABLE public.categorias_bienes TO inventario_app;
  `);
}

export const down = false;
