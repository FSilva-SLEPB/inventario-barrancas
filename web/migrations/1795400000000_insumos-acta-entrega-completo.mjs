export const shorthands = undefined;
export async function up(pgm) {
  pgm.sql(`
    -- Actas: externas (repositorio) + acta institucional entrega de insumos (secuencia única)
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS solicitud_insumo_id uuid REFERENCES public.solicitudes_insumos(id);
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS entrega_insumo_id uuid REFERENCES public.entregas_insumos(id);
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS origen_externo boolean NOT NULL DEFAULT false;
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS archivo_nombre text;
    ALTER TABLE public.actas_documentos DROP CONSTRAINT IF EXISTS actas_fuente_unica;
    ALTER TABLE public.actas_documentos ADD CONSTRAINT actas_fuente_unica CHECK (
      (origen_externo AND num_nonnulls(movimiento_id, entrega_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND movimiento_id IS NOT NULL AND num_nonnulls(entrega_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND entrega_id IS NOT NULL AND num_nonnulls(movimiento_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND operacion_id IS NOT NULL AND num_nonnulls(movimiento_id, entrega_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND solicitud_insumo_id IS NOT NULL AND num_nonnulls(movimiento_id, entrega_id, operacion_id) = 0)
      OR (NOT origen_externo AND entrega_insumo_id IS NOT NULL AND solicitud_insumo_id IS NULL AND num_nonnulls(movimiento_id, entrega_id, operacion_id) = 0)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS actas_documentos_solicitud_insumo_id_key ON public.actas_documentos(solicitud_insumo_id) WHERE solicitud_insumo_id IS NOT NULL AND pdf IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS actas_documentos_entrega_insumo_id_key ON public.actas_documentos(entrega_insumo_id) WHERE entrega_insumo_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.subir_acta_externa_acceso(p_actor text, p_id uuid, p_datos jsonb, p_pdf bytea, p_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a public.actas_documentos%ROWTYPE; numero bigint; datos jsonb; tipo text; fecha text; sede text; receptor text;
BEGIN
  PERFORM pg_advisory_xact_lock(1794355200000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
  IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 100 AND 8388608 OR left(encode(p_pdf,'escape'),5)<>'%PDF-' THEN RAISE EXCEPTION 'El archivo debe ser un PDF válido (máx. 8 MB).' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
  IF FOUND THEN
    IF a.actor=p_actor AND a.origen_externo AND a.pdf IS NOT NULL AND a.datos->>'archivoNombre'=COALESCE(p_datos->>'archivoNombre','') THEN
      RETURN jsonb_build_object('id',a.id,'folio',a.folio,'repetida',true);
    END IF;
    RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';
  END IF;
  tipo := COALESCE(NULLIF(trim(p_datos->>'tipo'),''),'externa');
  fecha := COALESCE(NULLIF(trim(p_datos->>'fecha'),''), CURRENT_DATE::text);
  sede := COALESCE(NULLIF(trim(p_datos->>'sedeNombre'),''), 'Sin sede indicada');
  receptor := COALESCE(NULLIF(trim(p_datos->>'receptorNombre'),''), 'Sin receptor indicado');
  UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702'; END IF;
  datos := jsonb_build_object(
    'schema', 4,
    'modelo', 'externa-subida',
    'tipo', tipo,
    'fecha', fecha,
    'emitidoEn', CURRENT_TIMESTAMP,
    'movimientoId', NULL,
    'entregaId', NULL,
    'operacionId', NULL,
    'clase', COALESCE(NULLIF(p_datos->>'clase',''),'equipo'),
    'origen', COALESCE(NULLIF(p_datos->>'origen',''),'Documento externo'),
    'destino', COALESCE(NULLIF(p_datos->>'destino',''),'Repositorio de actas'),
    'sedeNombre', sede,
    'sedeTipo', COALESCE(p_datos->>'sedeTipo',''),
    'rbd', COALESCE(p_datos->>'rbd',''),
    'receptorNombre', receptor,
    'actor', p_actor,
    'actorNombre', COALESCE((SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor), ''),
    'bienes', COALESCE(p_datos->'bienes', '[]'::jsonb),
    'metadata', jsonb_build_object('entregaNombre',COALESCE(p_datos->>'entregaNombre',''),'entregaRun','','entregaCargo','','entregaCorreo','','recibeRun','','recibeCargo',COALESCE(p_datos->>'recibeCargo',''),'recibeCorreo','','recibeUnidad','','recibeSubdireccion','','accesorios','','observaciones',COALESCE(p_datos->>'observaciones','')),
    'folio', numero,
    'version', 1,
    'origenExterno', true,
    'archivoNombre', COALESCE(NULLIF(p_nombre,''), COALESCE(p_datos->>'archivoNombre','acta.pdf'))
  );
  INSERT INTO public.actas_documentos(id, folio, actor, solicitud, datos, pdf, sha256, origen_externo, archivo_nombre)
  VALUES (p_id, numero, p_actor, jsonb_build_object('externa',true,'nombre',COALESCE(p_nombre,'')), datos, p_pdf, encode(sha256(p_pdf),'hex'), true, p_nombre);
  RETURN jsonb_build_object('id',p_id,'folio',numero,'repetida',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.subir_acta_externa_acceso(text, uuid, jsonb, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subir_acta_externa_acceso(text, uuid, jsonb, bytea, text) TO inventario_app;

CREATE OR REPLACE FUNCTION public.entregar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  solicitud public.solicitudes_insumos%ROWTYPE;
  entrega record;
  entrega_id_existente uuid;
  linea_entrega record;
  fila_solicitud public.solicitudes_insumos_detalle%ROWTYPE;
  repetida boolean;
BEGIN
  PERFORM 1 FROM public.usuarios_acceso u
   WHERE u.correo = p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para entregar solicitudes de insumos' USING ERRCODE = '42501'; END IF;
  IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('receptor','responsable_ti','fecha_entrega','observaciones','lineas','acta_id','recibeRun','recibeCargo','recibeCorreo','entregaRun','entregaCargo','entregaCorreo'))
  THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE = '22023'; END IF;
  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P2604'; END IF;
  IF solicitud.estado = 'entregada' AND solicitud.acta_id IS NOT NULL AND COALESCE(NULLIF(p_datos->>'acta_id',''),'') = solicitud.acta_id::text THEN
    RETURN jsonb_build_object('id', p_solicitud, 'estado', 'entregada', 'entrega_id', (SELECT id::text FROM public.entregas_insumos WHERE solicitud_id = p_solicitud LIMIT 1), 'repetida', true);
  END IF;
  IF solicitud.estado <> 'aprobada' THEN RAISE EXCEPTION 'La solicitud no está aprobada o ya fue entregada/cancelada' USING ERRCODE = 'P2602'; END IF;
  repetida := EXISTS(SELECT 1 FROM public.entregas_insumos e WHERE e.solicitud_id = p_solicitud AND e.responsable_ti = p_actor);
  IF NOT repetida THEN
    INSERT INTO public.entregas_insumos (solicitud_id, responsable_ti, receptor, fecha_entrega, observaciones, acta_id)
    VALUES (p_solicitud, COALESCE(p_datos->>'responsable_ti',p_actor), COALESCE(p_datos->>'receptor',''), (p_datos->>'fecha_entrega')::date, COALESCE(p_datos->>'observaciones',''), NULLIF(p_datos->>'acta_id','')::uuid)
    RETURNING * INTO entrega;
    FOR linea_entrega IN
      SELECT (elem->>'producto_id')::uuid AS producto_id, (elem->>'cantidad_entregada')::integer AS cantidad_entregada
      FROM jsonb_array_elements(p_datos->'lineas') AS elem
    LOOP
      IF linea_entrega.producto_id IS NULL OR linea_entrega.cantidad_entregada IS NULL OR linea_entrega.cantidad_entregada < 0 THEN
        RAISE EXCEPTION 'Línea de entrega inválida' USING ERRCODE = '22023';
      END IF;
      SELECT * INTO STRICT fila_solicitud FROM public.solicitudes_insumos_detalle
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id;
      IF fila_solicitud.cantidad_entregada > 0 THEN RAISE EXCEPTION 'Producto ya entregado en esta solicitud' USING ERRCODE = 'P2602'; END IF;
      IF linea_entrega.cantidad_entregada > fila_solicitud.cantidad_aprobada THEN RAISE EXCEPTION 'Cantidad entregada excede la aprobada' USING ERRCODE = '22023'; END IF;
      IF linea_entrega.cantidad_entregada > 0 THEN
       INSERT INTO public.entregas_insumos_detalle (entrega_id, producto_id, cantidad_entregada)
       VALUES (entrega.id, linea_entrega.producto_id, linea_entrega.cantidad_entregada);
      END IF;
      UPDATE public.solicitudes_insumos_detalle SET cantidad_entregada = linea_entrega.cantidad_entregada
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id;
      UPDATE public.reservas_insumos SET consumida_en = CURRENT_TIMESTAMP
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id AND consumida_en IS NULL;
      UPDATE public.stock_insumos SET existencia = existencia - linea_entrega.cantidad_entregada,
          reservado = GREATEST(0, reservado - linea_entrega.cantidad_entregada), actualizado_en = CURRENT_TIMESTAMP
       WHERE producto_id = linea_entrega.producto_id;
    END LOOP;
    UPDATE public.solicitudes_insumos SET estado = 'entregada', entregado_en = CURRENT_TIMESTAMP,
        acta_id = COALESCE(NULLIF(p_datos->>'acta_id','')::uuid, solicitud.acta_id)
     WHERE id = p_solicitud;
  END IF;
  SELECT id INTO entrega_id_existente FROM public.entregas_insumos WHERE solicitud_id = p_solicitud LIMIT 1;
  RETURN jsonb_build_object('id', p_solicitud, 'estado', 'entregada', 'entrega_id', COALESCE(entrega_id_existente::text,''), 'repetida', repetida);
END;
$function$;
REVOKE ALL ON FUNCTION public.entregar_solicitud_insumos(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.entregar_solicitud_insumos(text, uuid, jsonb) TO inventario_app;

CREATE OR REPLACE FUNCTION public.preparar_acta_insumo_acceso(p_actor text, p_id uuid, p_solicitud uuid, p_metadata jsonb, p_lineas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  si public.solicitudes_insumos%ROWTYPE;
  sd record;
  a public.actas_documentos%ROWTYPE;
  meta jsonb;
  meta_in jsonb;
  datos jsonb;
  bienes jsonb;
  numero bigint;
  entrega_id uuid;
  fecha_entrega text;
  receptor_nombre text;
BEGIN
  PERFORM pg_advisory_xact_lock(1794355200000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR p_solicitud IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
  fecha_entrega := COALESCE(NULLIF(trim(p_metadata->>'fechaEntrega'),''), CURRENT_DATE::text);
  receptor_nombre := COALESCE(NULLIF(trim(p_metadata->>'recibeNombre'),''), NULLIF(trim(p_metadata->>'entregaNombre'),''), '');
  meta_in := jsonb_build_object(
    'entregaNombre', COALESCE(NULLIF(trim(p_metadata->>'entregaNombre'),''), p_actor),
    'entregaRun', COALESCE(p_metadata->>'entregaRun',''),
    'entregaCargo', COALESCE(NULLIF(trim(p_metadata->>'entregaCargo'),''),'UTIC'),
    'entregaCorreo', COALESCE(NULLIF(trim(p_metadata->>'entregaCorreo'),''), p_actor),
    'recibeRun', COALESCE(p_metadata->>'recibeRun',''),
    'recibeCargo', COALESCE(p_metadata->>'recibeCargo',''),
    'recibeCorreo', COALESCE(p_metadata->>'recibeCorreo',''),
    'recibeUnidad', COALESCE(p_metadata->>'recibeUnidad',''),
    'recibeSubdireccion', COALESCE(p_metadata->>'recibeSubdireccion',''),
    'accesorios', COALESCE(p_metadata->>'accesorios',''),
    'observaciones', COALESCE(p_metadata->>'observaciones','')
  );
  meta := public.normalizar_metadata_acta(meta_in, false);
  SELECT * INTO si FROM public.solicitudes_insumos WHERE id=p_solicitud FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible' USING ERRCODE='P2702'; END IF;
  SELECT id, nombre, COALESCE(rbd,'') AS rbd, tipo::text AS tipo, COALESCE(direccion,'') AS direccion, COALESCE(comuna,'') AS comuna, COALESCE(correo_institucional,'') AS correo
    INTO sd FROM public.sedes WHERE id=si.sede_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2702'; END IF;
  SELECT id INTO entrega_id FROM public.entregas_insumos WHERE solicitud_id=p_solicitud;
  SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
  IF FOUND THEN
    IF a.actor=p_actor AND a.solicitud_insumo_id=p_solicitud AND a.solicitud=meta THEN
      RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);
    END IF;
    RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';
  END IF;
  IF si.acta_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.actas_documentos WHERE id=si.acta_id AND pdf IS NOT NULL) THEN
    RAISE EXCEPTION 'La solicitud ya tiene un acta emitida' USING ERRCODE='P2701';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'producto_id', d.producto_id, 'codigo', c.codigo, 'nombre', c.nombre, 'categoria', c.categoria, 'unidad', c.unidad,
    'cantidad_solicitada', d.cantidad_solicitada, 'cantidad_aprobada', d.cantidad_aprobada,
    'cantidad_entregada', COALESCE((SELECT (e->>'cantidad_entregada')::int FROM jsonb_array_elements(COALESCE(p_lineas,'[]'::jsonb)) e WHERE (e->>'producto_id')::uuid=d.producto_id LIMIT 1), d.cantidad_entregada, d.cantidad_aprobada)
  ) ORDER BY c.codigo), '[]'::jsonb) INTO bienes
  FROM public.solicitudes_insumos_detalle d JOIN public.catalogo_insumos c ON c.id=d.producto_id
  WHERE d.solicitud_id=p_solicitud;
  UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702'; END IF;
  datos := jsonb_build_object(
    'schema', 4, 'modelo', 'institucional-20261104',
    'tipo', 'entrega_insumo',
    'fecha', fecha_entrega,
    'emitidoEn', CURRENT_TIMESTAMP,
    'movimientoId', NULL, 'entregaId', entrega_id, 'solicitudInsumoId', p_solicitud,
    'clase', 'insumo',
    'origen', 'Bodega TI / Insumos',
    'destino', sd.nombre,
    'sedeNombre', sd.nombre, 'rbd', sd.rbd, 'sedeTipo', sd.tipo,
    'sedeDatos', jsonb_build_object('direccion', sd.direccion, 'comuna', sd.comuna, 'correoInstitucional', sd.correo),
    'receptorNombre', COALESCE(NULLIF(receptor_nombre,''), si.solicitante_correo),
    'actor', p_actor,
    'actorNombre', COALESCE((SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor), p_actor),
    'bienes', bienes,
    'metadata', meta,
    'folio', numero, 'version', 1
  );
  INSERT INTO public.actas_documentos(id, solicitud_insumo_id, entrega_insumo_id, folio, actor, solicitud, datos)
  VALUES (p_id, p_solicitud, entrega_id, numero, p_actor, meta, datos);
  RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.preparar_acta_insumo_acceso(text,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_insumo_acceso(text,uuid,uuid,jsonb,jsonb) TO inventario_app;

CREATE OR REPLACE FUNCTION public.vincular_acta_entrega_insumo_acceso(p_actor text, p_acta uuid, p_entrega uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  UPDATE public.actas_documentos
     SET entrega_insumo_id = p_entrega
   WHERE id = p_acta
     AND solicitud_insumo_id IS NOT NULL
     AND entrega_insumo_id IS NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.vincular_acta_entrega_insumo_acceso(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_acta_entrega_insumo_acceso(text,uuid,uuid) TO inventario_app;
  `);
}
export async function down(pgm) {
  pgm.sql(`
    DROP FUNCTION IF EXISTS public.vincular_acta_entrega_insumo_acceso(text,uuid,uuid);
    DROP FUNCTION IF EXISTS public.preparar_acta_insumo_acceso(text,uuid,uuid,jsonb,jsonb);
  `);
}
