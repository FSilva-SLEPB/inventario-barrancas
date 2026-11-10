export function up(pgm){
 pgm.sql(`
  ALTER TABLE public.solicitudes_insumos
    ADD COLUMN IF NOT EXISTS solicitante_nombre text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS solicitante_run text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS solicitante_cargo text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS solicitante_telefono text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS modalidad_entrega text NOT NULL DEFAULT '';

  -- Crea o reemplaza la función de creación de solicitud (carrito).
  -- p_datos (jsonb opcional): {nombre,run,cargo,telefono,modalidad,motivo}
  CREATE OR REPLACE FUNCTION public.crear_solicitud_insumos(p_actor text, p_sede_id uuid, p_lineas jsonb, p_datos jsonb DEFAULT '{}'::jsonb)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, pg_temp
  AS $fn$
  DECLARE
    v_id uuid;
    v_actor text := lower(trim(COALESCE(p_actor,'')));
    elem jsonb;
    v_pid uuid;
    v_cant integer;
    v_nombre text := COALESCE(trim(p_datos->>'nombre'),'');
    v_run text := COALESCE(trim(p_datos->>'run'),'');
    v_cargo text := COALESCE(trim(p_datos->>'cargo'),'');
    v_tel text := COALESCE(trim(p_datos->>'telefono'),'');
    v_mod text := COALESCE(trim(p_datos->>'modalidad'),'');
    v_motivo text := COALESCE(trim(p_datos->>'motivo'),'');
  BEGIN
    PERFORM 1 FROM public.usuarios_acceso u WHERE lower(u.correo)=v_actor AND u.activo FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para crear solicitudes de insumos' USING ERRCODE='42501'; END IF;
    IF p_sede_id IS NULL OR jsonb_typeof(p_lineas) <> 'array' OR jsonb_array_length(p_lineas)=0 THEN
      RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';
    END IF;

    INSERT INTO public.solicitudes_insumos
      (sede_id, solicitante_correo, estado, motivo, solicitante_nombre, solicitante_run, solicitante_cargo, solicitante_telefono, modalidad_entrega)
    VALUES
      (p_sede_id, v_actor, 'solicitada', v_motivo, left(v_nombre,200), left(v_run,20), left(v_cargo,200), left(v_tel,40), left(v_mod,40))
    RETURNING id INTO v_id;

    FOR elem IN SELECT * FROM jsonb_array_elements(p_lineas)
    LOOP
      v_pid := (elem->>'producto_id')::uuid;
      v_cant := COALESCE((elem->>'cantidad')::integer, (elem->>'cantidad_solicitada')::integer);
      IF v_pid IS NULL OR v_cant IS NULL OR v_cant < 1 OR v_cant > 10000 THEN
        RAISE EXCEPTION 'Línea de carrito inválida' USING ERRCODE='22023';
      END IF;
      INSERT INTO public.solicitudes_insumos_detalle (solicitud_id, producto_id, cantidad_solicitada, cantidad_aprobada, cantidad_entregada)
      VALUES (v_id, v_pid, v_cant, 0, 0);
    END LOOP;

    RETURN v_id;
  END;
  $fn$;
  REVOKE ALL ON FUNCTION public.crear_solicitud_insumos(text, uuid, jsonb, jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.crear_solicitud_insumos(text, uuid, jsonb, jsonb) TO inventario_app;
 `);
}
export function down(){ throw new Error('Conservar datos de solicitudes de insumos; no hay reversión automática.'); }
