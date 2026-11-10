export function up(pgm) {
  pgm.sql(`
-- Módulo de solicitudes de insumos (diseño acordado 29/10/2026, pendiente de implementar).
-- Catálogo de productos de insumo, diferenciados del inventario de equipos individuales.
CREATE TABLE public.catalogo_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE CHECK (codigo <> ''),
  nombre text NOT NULL CHECK (nombre <> ''),
  categoria text NOT NULL CHECK (categoria <> ''),
  unidad text NOT NULL CHECK (unidad <> ''),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.catalogo_insumos IS 'Referencia de productos, categorías, unidad y estado activo de insumos de bodega TIC.';
COMMENT ON COLUMN public.catalogo_insumos.codigo IS 'Código único de producto del catálogo (ej. mouse, cable, tóner).';
COMMENT ON COLUMN public.catalogo_insumos.unidad IS 'Unidad de medida: unidad, caja, kit, metro, etc. No convertir cajas a unidades sin equivalencia acordada.';

-- Existencia física en bodega de TIC. Una fila por producto del catálogo.
CREATE TABLE public.stock_insumos (
  producto_id uuid PRIMARY KEY REFERENCES public.catalogo_insumos(id) ON DELETE RESTRICT,
  existencia integer NOT NULL DEFAULT 0 CHECK (existencia >= 0),
  reservado integer NOT NULL DEFAULT 0 CHECK (reservado >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (reservado <= existencia + reservado)
);
COMMENT ON TABLE public.stock_insumos IS 'Existencia física y cantidades reservadas por producto de insumo.';
COMMENT ON COLUMN public.stock_insumos.existencia IS 'Cantidad que permanece en bodega (disponible + reservado).';
COMMENT ON COLUMN public.stock_insumos.reservado IS 'Cantidad aprobada y comprometida en solicitudes no entregadas ni canceladas.';

-- Solicitud de insumos de una sede (EE/JI), vinculada a la cuenta que la envía.
CREATE TABLE public.solicitudes_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  solicitante_correo text NOT NULL CHECK (solicitante_correo <> ''),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobada','entregada','cancelada')),
  motivo text DEFAULT '',
  solicitado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  aprobado_en timestamptz,
  entregado_en timestamptz,
  cancelado_en timestamptz,
  aprobado_por text,
  cancelado_por text,
  cancelado_motivo text,
  acta_id uuid REFERENCES public.actas_documentos(id) ON DELETE SET NULL,
  CHECK (estado <> 'entregada' OR entregado_en IS NOT NULL),
  CHECK (estado <> 'cancelada' OR cancelado_en IS NOT NULL),
  CHECK (estado <> 'aprobada' OR aprobado_en IS NOT NULL)
);
COMMENT ON TABLE public.solicitudes_insumos IS 'Solicitudes de insumos de establecimientos educacionales y jardines infantiles.';
COMMENT ON COLUMN public.solicitudes_insumos.estado IS 'pendiente: carrito enviado; aprobada: TI revisó y reservó; entregada: entrega única confirmada; cancelada: TI canceló antes de entregar.';

-- Líneas de producto y cantidad de cada solicitud.
CREATE TABLE public.solicitudes_insumos_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_insumos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.catalogo_insumos(id) ON DELETE RESTRICT,
  cantidad_solicitada integer NOT NULL CHECK (cantidad_solicitada > 0),
  cantidad_aprobada integer NOT NULL DEFAULT 0 CHECK (cantidad_aprobada >= 0),
  cantidad_entregada integer NOT NULL DEFAULT 0 CHECK (cantidad_entregada >= 0),
  motivo_reduccion text DEFAULT '',
  CONSTRAINT chk_aprobada_no_excede_solicitada CHECK (cantidad_aprobada <= cantidad_solicitada),
  CONSTRAINT chk_entregada_no_excede_aprobada CHECK (cantidad_entregada <= cantidad_aprobada)
);
COMMENT ON TABLE public.solicitudes_insumos_detalle IS 'Cantidad solicitada, aprobada y entregada por producto de cada solicitud.';

-- Reserva atómica de cantidades aprobadas pendientes de entrega.
CREATE TABLE public.reservas_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_insumos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.catalogo_insumos(id) ON DELETE RESTRICT,
  cantidad_reservada integer NOT NULL CHECK (cantidad_reservada > 0),
  creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumida_en timestamptz,
  liberada_en timestamptz,
  UNIQUE (solicitud_id, producto_id)
);
COMMENT ON TABLE public.reservas_insumos IS 'Cantidad aprobada y comprometida en solicitud no entregada ni cancelada.';

-- Entrega única de una solicitud aprobada. Todas las cantidades aprobadas en un solo acto.
CREATE TABLE public.entregas_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.solicitudes_insumos(id) ON DELETE RESTRICT,
  responsable_ti text NOT NULL CHECK (responsable_ti <> ''),
  receptor text NOT NULL CHECK (receptor <> ''),
  fecha_entrega date NOT NULL DEFAULT CURRENT_DATE,
  acta_id uuid REFERENCES public.actas_documentos(id) ON DELETE SET NULL,
  observaciones text DEFAULT '',
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (solicitud_id)
);
COMMENT ON TABLE public.entregas_insumos IS 'Una única entrega por solicitud, con todas las cantidades aprobadas.';

-- Cantidades efectivamente entregadas por producto.
CREATE TABLE public.entregas_insumos_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.entregas_insumos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.catalogo_insumos(id) ON DELETE RESTRICT,
  cantidad_entregada integer NOT NULL CHECK (cantidad_entregada > 0),
  CONSTRAINT entregas_insumos_detalle_entrega_producto_key UNIQUE (entrega_id, producto_id)
);
COMMENT ON TABLE public.entregas_insumos_detalle IS 'Cantidades entregadas por producto en la entrega única de una solicitud.';

-- Índices de consulta frecuente.
CREATE INDEX solicitudes_insumos_sede_idx ON public.solicitudes_insumos(sede_id);
CREATE INDEX solicitudes_insumos_estado_idx ON public.solicitudes_insumos(estado);
CREATE INDEX reservas_insumos_producto_idx ON public.reservas_insumos(producto_id);

-- Permisos: inventario_app solo lee; escribe mediante funciones SECURITY DEFINER.
REVOKE ALL ON public.catalogo_insumos FROM PUBLIC, inventario_app;
REVOKE ALL ON public.stock_insumos FROM PUBLIC, inventario_app;
REVOKE ALL ON public.solicitudes_insumos FROM PUBLIC, inventario_app;
REVOKE ALL ON public.solicitudes_insumos_detalle FROM PUBLIC, inventario_app;
REVOKE ALL ON public.reservas_insumos FROM PUBLIC, inventario_app;
REVOKE ALL ON public.entregas_insumos FROM PUBLIC, inventario_app;
REVOKE ALL ON public.entregas_insumos_detalle FROM PUBLIC, inventario_app;
GRANT SELECT ON public.catalogo_insumos TO inventario_app;
GRANT SELECT ON public.stock_insumos TO inventario_app;
GRANT SELECT ON public.solicitudes_insumos TO inventario_app;
GRANT SELECT ON public.solicitudes_insumos_detalle TO inventario_app;
GRANT SELECT ON public.reservas_insumos TO inventario_app;
GRANT SELECT ON public.entregas_insumos TO inventario_app;
GRANT SELECT ON public.entregas_insumos_detalle TO inventario_app;

-- Función: aprobar solicitud (TI). Reserva disponibilidad atómicamente.
CREATE FUNCTION public.aprobar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  solicitud public.solicitudes_insumos%ROWTYPE;
  linea record;
  stock record;
  reserva record;
  repetida boolean;
  k text;
BEGIN
  -- Solo TI (administrador / administrador_gestion) aprueba.
  PERFORM 1 FROM public.usuarios_acceso u
   WHERE u.correo = p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin autorización para aprobar solicitudes de insumos' USING ERRCODE = '42501';
  END IF;

  -- Validación de la solicitud de entrada.
  IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('lineas','motivo'))
  THEN
    RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P2604';
  END IF;
  IF solicitud.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud ya no está pendiente' USING ERRCODE = 'P2602';
  END IF;

  -- Detectar reenvío idempotente (misma solicitud, mismos datos).
  repetida := solicitud.estado = 'aprobada'
           AND solicitud.aprobado_por = p_actor
           AND solicitud.motivo = COALESCE(p_datos->>'motivo','');

  IF NOT repetida THEN
    -- Validar y aprobar cada línea atómicamente.
    FOR linea IN
      SELECT (elem->>'producto_id') AS producto_id,
             (elem->>'cantidad_aprobada')::integer AS cantidad_aprobada,
             (elem->>'motivo_reduccion') AS motivo_reduccion
      FROM jsonb_array_elements(p_datos->'lineas') AS elem
    LOOP
      IF linea.producto_id IS NULL OR linea.producto_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'Producto inválido en línea de aprobación' USING ERRCODE = '22023';
      END IF;
      IF linea.cantidad_aprobada IS NULL OR linea.cantidad_aprobada < 0 THEN
        RAISE EXCEPTION 'Cantidad aprobada inválida' USING ERRCODE = '22023';
      END IF;

      SELECT * INTO stock FROM public.stock_insumos
       WHERE producto_id = linea.producto_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto sin existencia registrada en bodega' USING ERRCODE = 'P2604';
      END IF;

      -- Disponible = existencia - reservado. No aprobar más de lo disponible.
      IF (stock.existencia - stock.reservado) < linea.cantidad_aprobada THEN
        RAISE EXCEPTION 'Disponibilidad insuficiente para el producto %', linea.producto_id USING ERRCODE = 'P2604';
      END IF;

      -- Actualizar línea de solicitud con cantidad aprobada y motivo de reducción.
      UPDATE public.solicitudes_insumos_detalle
       SET cantidad_aprobada = linea.cantidad_aprobada,
           motivo_reduccion = COALESCE(linea.motivo_reduccion, '')
       WHERE solicitud_id = p_solicitud AND producto_id = linea.producto_id;

      -- Crear reserva por la cantidad aprobada.
      INSERT INTO public.reservas_insumos (solicitud_id, producto_id, cantidad_reservada)
      VALUES (p_solicitud, linea.producto_id, linea.cantidad_aprobada)
      ON CONFLICT (solicitud_id, producto_id) DO UPDATE
       SET cantidad_reservada = EXCLUDED.cantidad_reservada,
           creada_en = CURRENT_TIMESTAMP,
           consumida_en = NULL,
           liberada_en = NULL;

      -- Incrementar reservado en stock.
      UPDATE public.stock_insumos
       SET reservado = reservado + linea.cantidad_aprobada,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE producto_id = linea.producto_id;
    END LOOP;

    -- Marcar solicitud como aprobada.
    UPDATE public.solicitudes_insumos
     SET estado = 'aprobada',
         aprobado_en = CURRENT_TIMESTAMP,
         aprobado_por = p_actor,
         motivo = COALESCE(p_datos->>'motivo', solicitud.motivo)
     WHERE id = p_solicitud;
  END IF;

  RETURN jsonb_build_object(
    'id', p_solicitud,
    'estado', solicitud.estado,
    'repetida', repetida,
    'aprobado_en', COALESCE(solicitud.aprobado_en::text, CURRENT_TIMESTAMP::text)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.aprobar_solicitud_insumos(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_insumos(text, uuid, jsonb) TO inventario_app;

-- Función: entregar solicitud (TI). Descuenta existencia, consume reserva, emite acta.
CREATE FUNCTION public.entregar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  solicitud public.solicitudes_insumos%ROWTYPE;
  entrega record;
  linea_entrega record;
  fila_solicitud public.solicitudes_insumos_detalle%ROWTYPE;
  repetida boolean;
BEGIN
  -- Solo TI entrega.
  PERFORM 1 FROM public.usuarios_acceso u
   WHERE u.correo = p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin autorización para entregar solicitudes de insumos' USING ERRCODE = '42501';
  END IF;

  IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('receptor','responsable_ti','fecha_entrega','observaciones','lineas'))
  THEN
    RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P2604';
  END IF;
  IF solicitud.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'La solicitud no está aprobada o ya fue entregada/cancelada' USING ERRCODE = 'P2602';
  END IF;

  -- Idempotencia: misma solicitud entregada por el mismo responsable.
  repetida := EXISTS(SELECT 1 FROM public.entregas_insumos e WHERE e.solicitud_id = p_solicitud AND e.responsable_ti = p_actor);

  IF NOT repetida THEN
    -- Crear entrega única.
    INSERT INTO public.entregas_insumos (solicitud_id, responsable_ti, receptor, fecha_entrega, observaciones)
    VALUES (p_solicitud, p_datos->>'responsable_ti', p_datos->>'receptor',
            (p_datos->>'fecha_entrega')::date, COALESCE(p_datos->>'observaciones',''))
    RETURNING * INTO entrega;

    -- Detalle de entrega y descuento de existencia / consumo de reserva.
    FOR linea_entrega IN
      SELECT (elem->>'producto_id') AS producto_id,
             (elem->>'cantidad_entregada')::integer AS cantidad_entregada
      FROM jsonb_array_elements(p_datos->'lineas') AS elem
    LOOP
      IF linea_entrega.producto_id IS NULL
         OR linea_entrega.producto_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR linea_entrega.cantidad_entregada IS NULL
         OR linea_entrega.cantidad_entregada <= 0
      THEN
        RAISE EXCEPTION 'Línea de entrega inválida' USING ERRCODE = '22023';
      END IF;

      -- Leer la línea aprobada de la solicitud para este producto.
      SELECT * INTO STRICT fila_solicitud FROM public.solicitudes_insumos_detalle
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id;

      -- La cantidad entregada no debe exceder la aprobada.
      IF fila_solicitud.cantidad_entregada > 0 THEN
        RAISE EXCEPTION 'Producto ya entregado en esta solicitud' USING ERRCODE = 'P2602';
      END IF;
      IF linea_entrega.cantidad_entregada > fila_solicitud.cantidad_aprobada THEN
        RAISE EXCEPTION 'Cantidad entregada excede la aprobada' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.entregas_insumos_detalle (entrega_id, producto_id, cantidad_entregada)
      VALUES (entrega.id, linea_entrega.producto_id, linea_entrega.cantidad_entregada);

      -- Marcar la línea como entregada.
      UPDATE public.solicitudes_insumos_detalle
       SET cantidad_entregada = linea_entrega.cantidad_entregada
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id;

      -- Consumir reserva y descontar existencia física.
      UPDATE public.reservas_insumos
       SET consumida_en = CURRENT_TIMESTAMP
       WHERE solicitud_id = p_solicitud AND producto_id = linea_entrega.producto_id AND consumida_en IS NULL;

      UPDATE public.stock_insumos
       SET existencia = existencia - linea_entrega.cantidad_entregada,
           reservado = reservado - linea_entrega.cantidad_entregada,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE producto_id = linea_entrega.producto_id;
    END LOOP;

    -- Cerrar solicitud como entregada y vincular acta si se proviste.
    UPDATE public.solicitudes_insumos
     SET estado = 'entregada',
         entregado_en = CURRENT_TIMESTAMP,
         acta_id = COALESCE((p_datos->>'acta_id')::uuid, solicitud.acta_id)
     WHERE id = p_solicitud;
  END IF;

  RETURN jsonb_build_object(
    'id', p_solicitud,
    'estado', solicitud.estado,
    'entrega_id', COALESCE((SELECT id FROM public.entregas_insumos WHERE solicitud_id = p_solicitud LIMIT 1)::text, ''),
    'repetida', repetida
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.entregar_solicitud_insumos(text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.entregar_solicitud_insumos(text, uuid, jsonb) TO inventario_app;

-- Función: cancelar solicitud (TI). Libera reserva, conserva historial.
CREATE FUNCTION public.cancelar_solicitud_insumos(p_actor text, p_solicitud uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
DECLARE
  solicitud public.solicitudes_insumos%ROWTYPE;
BEGIN
  -- Solo TI cancela.
  PERFORM 1 FROM public.usuarios_acceso u
   WHERE u.correo = p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sin autorización para cancelar solicitudes de insumos' USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Se requiere motivo de cancelación' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO solicitud FROM public.solicitudes_insumos WHERE id = p_solicitud FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'P2604';
  END IF;
  IF solicitud.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'Solo se puede cancelar una solicitud aprobada y no entregada' USING ERRCODE = 'P2602';
  END IF;

  -- Liberar reservas y devolver reservado a existencia.
  UPDATE public.reservas_insumos r
   SET liberada_en = CURRENT_TIMESTAMP
  FROM public.stock_insumos s
  WHERE r.solicitud_id = p_solicitud
    AND r.producto_id = s.producto_id
    AND r.liberada_en IS NULL;

  UPDATE public.stock_insumos s
   SET reservado = reservado - r.cantidad_reservada,
       actualizado_en = CURRENT_TIMESTAMP
  FROM public.reservas_insumos r
  WHERE s.producto_id = r.producto_id
    AND r.solicitud_id = p_solicitud
    AND r.liberada_en = CURRENT_TIMESTAMP;

  UPDATE public.solicitudes_insumos
   SET estado = 'cancelada',
       cancelado_en = CURRENT_TIMESTAMP,
       cancelado_por = p_actor,
       cancelado_motivo = trim(p_motivo)
   WHERE id = p_solicitud;
END;
$fn$;
REVOKE ALL ON FUNCTION public.cancelar_solicitud_insumos(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitud_insumos(text, uuid, text) TO inventario_app;
`);}
export function down() {
  throw new Error('Conservar solicitudes, reservas y actas de insumos; no hay reversión automática.');
}