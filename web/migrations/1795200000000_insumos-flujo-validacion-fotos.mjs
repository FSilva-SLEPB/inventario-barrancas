export function up(pgm) {
  pgm.sql(`
-- Flujo confirmado 8/11/2026: solicitud → validación → aprobación → contra entrega + acta.
-- Fotos de catálogo (subidas por TI/admin).
ALTER TABLE public.catalogo_insumos ADD COLUMN IF NOT EXISTS foto_url text;
COMMENT ON COLUMN public.catalogo_insumos.foto_url IS 'Ruta relativa de la imagen del insumo (subida al servidor).';

-- Estados y trazabilidad de validación.
ALTER TABLE public.solicitudes_insumos DROP CONSTRAINT IF EXISTS solicitudes_insumos_estado_check;
ALTER TABLE public.solicitudes_insumos ADD CONSTRAINT solicitudes_insumos_estado_check
  CHECK (estado IN ('solicitada','en_validacion','aprobada','entregada','cancelada'));
UPDATE public.solicitudes_insumos SET estado='solicitada' WHERE estado='pendiente';
ALTER TABLE public.solicitudes_insumos ALTER COLUMN estado SET DEFAULT 'solicitada';
ALTER TABLE public.solicitudes_insumos ADD COLUMN IF NOT EXISTS validado_en timestamptz;
ALTER TABLE public.solicitudes_insumos ADD COLUMN IF NOT EXISTS validado_por text;
ALTER TABLE public.solicitudes_insumos ADD COLUMN IF NOT EXISTS observacion_validacion text DEFAULT '';
ALTER TABLE public.solicitudes_insumos DROP CONSTRAINT IF EXISTS solicitudes_insumos_check1;
ALTER TABLE public.solicitudes_insumos ADD CONSTRAINT solicitudes_insumos_check1 CHECK (estado <> 'entregada' OR entregado_en IS NOT NULL);
ALTER TABLE public.solicitudes_insumos DROP CONSTRAINT IF EXISTS solicitudes_insumos_check2;
ALTER TABLE public.solicitudes_insumos ADD CONSTRAINT solicitudes_insumos_check2 CHECK (estado <> 'cancelada' OR cancelado_en IS NOT NULL);
ALTER TABLE public.solicitudes_insumos DROP CONSTRAINT IF EXISTS solicitudes_insumos_check3;
ALTER TABLE public.solicitudes_insumos ADD CONSTRAINT solicitudes_insumos_check3 CHECK (estado <> 'aprobada' OR aprobado_en IS NOT NULL);
COMMENT ON COLUMN public.solicitudes_insumos.estado IS 'solicitada: carrito enviado; en_validacion: TI revisa; aprobada: TI autorizó y reservó; entregada: contra entrega confirmada; cancelada.';

-- Validar solicitud (TI): solicitada -> en_validacion.
CREATE OR REPLACE FUNCTION public.validar_solicitud_insumos(p_actor text, p_solicitud uuid, p_observacion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE s public.solicitudes_insumos%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para validar solicitudes de insumos' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE='P2604'; END IF;
  IF s.estado <> 'solicitada' THEN RAISE EXCEPTION 'Solo se puede validar una solicitud en estado solicitada' USING ERRCODE='P2602'; END IF;
  UPDATE public.solicitudes_insumos SET estado='en_validacion', validado_en=CURRENT_TIMESTAMP, validado_por=p_actor, observacion_validacion=COALESCE(trim(p_observacion),'') WHERE id=p_solicitud;
  RETURN jsonb_build_object('id',p_solicitud,'estado','en_validacion');
END;
$fn$;
REVOKE ALL ON FUNCTION public.validar_solicitud_insumos(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_solicitud_insumos(text,uuid,text) TO inventario_app;

-- Aprobar: ahora desde en_validacion (reserva atómica). Reemplaza versión anterior.
CREATE OR REPLACE FUNCTION public.aprobar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  solicitud public.solicitudes_insumos%ROWTYPE;
  linea record;
  stock record;
  repetida boolean;
BEGIN
  PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para aprobar solicitudes de insumos' USING ERRCODE='42501'; END IF;
  IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('lineas','motivo'))
  THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023'; END IF;

  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE='P2604'; END IF;
  IF solicitud.estado <> 'en_validacion' THEN RAISE EXCEPTION 'La solicitud debe estar en validación para aprobarse' USING ERRCODE='P2602'; END IF;

  repetida := false;
  IF NOT repetida THEN
    FOR linea IN
      SELECT (elem->>'producto_id') AS producto_id,
             (elem->>'cantidad_aprobada')::integer AS cantidad_aprobada,
             (elem->>'motivo_reduccion') AS motivo_reduccion
      FROM jsonb_array_elements(p_datos->'lineas') AS elem
    LOOP
      IF linea.producto_id IS NULL OR linea.producto_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Producto inválido en línea de aprobación' USING ERRCODE='22023'; END IF;
      IF linea.cantidad_aprobada IS NULL OR linea.cantidad_aprobada < 0 THEN
        RAISE EXCEPTION 'Cantidad aprobada inválida' USING ERRCODE='22023'; END IF;
      SELECT * INTO stock FROM public.stock_insumos WHERE producto_id=linea.producto_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Producto sin existencia registrada en bodega' USING ERRCODE='P2604'; END IF;
      IF (stock.existencia - stock.reservado) < linea.cantidad_aprobada THEN
        RAISE EXCEPTION 'Disponibilidad insuficiente para el producto %', linea.producto_id USING ERRCODE='P2604'; END IF;
      UPDATE public.solicitudes_insumos_detalle SET cantidad_aprobada=linea.cantidad_aprobada, motivo_reduccion=COALESCE(linea.motivo_reduccion,'')
       WHERE solicitud_id=p_solicitud AND producto_id=linea.producto_id;
      IF linea.cantidad_aprobada > 0 THEN
        INSERT INTO public.reservas_insumos (solicitud_id,producto_id,cantidad_reservada)
        VALUES (p_solicitud,linea.producto_id,linea.cantidad_aprobada)
        ON CONFLICT (solicitud_id,producto_id) DO UPDATE SET cantidad_reservada=EXCLUDED.cantidad_reservada, creada_en=CURRENT_TIMESTAMP, consumida_en=NULL, liberada_en=NULL;
        UPDATE public.stock_insumos SET reservado=reservado+linea.cantidad_aprobada, actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=linea.producto_id;
      END IF;
    END LOOP;
    UPDATE public.solicitudes_insumos SET estado='aprobada', aprobado_en=CURRENT_TIMESTAMP, aprobado_por=p_actor, motivo=COALESCE(p_datos->>'motivo',solicitud.motivo) WHERE id=p_solicitud;
  END IF;
  RETURN jsonb_build_object('id',p_solicitud,'estado','aprobada','repetida',repetida);
END;
$fn$;
REVOKE ALL ON FUNCTION public.aprobar_solicitud_insumos(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_insumos(text,uuid,jsonb) TO inventario_app;

-- Cancelar: permitir desde solicitada, en_validacion o aprobada (libera reservas si las hay).
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_insumos(p_actor text, p_solicitud uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE solicitud public.solicitudes_insumos%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para cancelar solicitudes de insumos' USING ERRCODE='42501'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo)='' THEN RAISE EXCEPTION 'Se requiere motivo de cancelación' USING ERRCODE='22023'; END IF;
  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE='P2604'; END IF;
  IF solicitud.estado NOT IN ('solicitada','en_validacion','aprobada') THEN RAISE EXCEPTION 'Solo se puede cancelar una solicitud no entregada' USING ERRCODE='P2602'; END IF;
  -- Liberar reservas vigentes.
  UPDATE public.reservas_insumos r SET liberada_en=CURRENT_TIMESTAMP
  FROM public.stock_insumos s WHERE r.solicitud_id=p_solicitud AND r.producto_id=s.producto_id AND r.liberada_en IS NULL AND r.consumida_en IS NULL;
  UPDATE public.stock_insumos s SET reservado = GREATEST(0, reservado - COALESCE((SELECT sum(cantidad_reservada) FROM public.reservas_insumos r WHERE r.solicitud_id=p_solicitud AND r.producto_id=s.producto_id AND r.liberada_en=CURRENT_TIMESTAMP),0)), actualizado_en=CURRENT_TIMESTAMP
  WHERE s.producto_id IN (SELECT producto_id FROM public.reservas_insumos WHERE solicitud_id=p_solicitud AND liberada_en=CURRENT_TIMESTAMP);
  UPDATE public.solicitudes_insumos SET estado='cancelada', cancelado_en=CURRENT_TIMESTAMP, cancelado_por=p_actor, cancelado_motivo=trim(p_motivo) WHERE id=p_solicitud;
END;
$fn$;
REVOKE ALL ON FUNCTION public.cancelar_solicitud_insumos(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitud_insumos(text,uuid,text) TO inventario_app;

-- entregar_solicitud_insumos se mantiene (requiere aprobada); contra entrega genera acta en capa app/BD según integración.
`);}
export function down(){ throw new Error('Conservar cambios de flujo de insumos; no hay reversión automática.'); }
