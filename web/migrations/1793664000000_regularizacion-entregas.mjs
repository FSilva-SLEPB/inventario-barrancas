export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.entregas_lotes (
  id uuid PRIMARY KEY,
  actor text NOT NULL,
  datos jsonb NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad BETWEEN 1 AND 2500),
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.entregas_equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES public.entregas_lotes(id) ON DELETE RESTRICT,
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  sede_nombre text NOT NULL,
  sede_rbd text,
  comuna text,
  fecha_entrega date NOT NULL,
  receptor_nombre text NOT NULL CHECK (length(btrim(receptor_nombre)) BETWEEN 1 AND 200),
  receptor_cargo text NOT NULL CHECK (receptor_cargo='Directora del jardín infantil'),
  tipo text NOT NULL DEFAULT 'regularizacion_historica' CHECK (tipo='regularizacion_historica'),
  acta_sin_folio boolean NOT NULL DEFAULT true CHECK (acta_sin_folio),
  enlace_acta text CHECK (enlace_acta IS NULL OR (length(enlace_acta)<=1500 AND enlace_acta ~ '^https?://')),
  UNIQUE (lote_id,sede_id)
);
CREATE TABLE public.entregas_detalle (
  entrega_id uuid NOT NULL REFERENCES public.entregas_equipos(id) ON DELETE RESTRICT,
  equipo_id uuid NOT NULL REFERENCES public.equipos(id) ON DELETE RESTRICT,
  antes jsonb NOT NULL,
  despues jsonb NOT NULL,
  PRIMARY KEY (entrega_id,equipo_id)
);
ALTER TABLE public.equipos_historial ADD COLUMN entrega_id uuid REFERENCES public.entregas_equipos(id) ON DELETE RESTRICT;
CREATE INDEX entregas_sede_idx ON public.entregas_equipos(sede_id,fecha_entrega);
CREATE INDEX entregas_detalle_equipo_idx ON public.entregas_detalle(equipo_id);
REVOKE ALL ON public.entregas_lotes,public.entregas_equipos,public.entregas_detalle FROM PUBLIC,inventario_app;
GRANT SELECT ON public.entregas_lotes,public.entregas_equipos,public.entregas_detalle TO inventario_app;

CREATE FUNCTION public.regularizar_entregas_acceso(p_actor text,p_solicitud uuid,p_grupos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE
  lote public.entregas_lotes%ROWTYPE;
  sede public.sedes%ROWTYPE;
  anterior public.equipos%ROWTYPE;
  posterior public.equipos%ROWTYPE;
  grupo jsonb; item jsonb; entrega uuid; fecha date;
  nombre text; enlace text; cantidad integer:=0; grupos integer:=0;
  vistos uuid[]:=ARRAY[]::uuid[];
  sedes_vistas uuid[]:=ARRAY[]::uuid[];
  equipo_uuid uuid;
BEGIN
  -- Mismo bloqueo que altas/correcciones/cargas: una versión no cambia entre revisión y escritura.
  PERFORM pg_advisory_xact_lock(1793577600000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo
    AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF p_solicitud IS NULL OR jsonb_typeof(p_grupos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_grupos) NOT BETWEEN 1 AND 2500 OR octet_length(p_grupos::text)>1000000 THEN
    RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023'; END IF;
  SELECT * INTO lote FROM public.entregas_lotes WHERE id=p_solicitud;
  IF FOUND THEN
    IF lote.actor<>p_actor OR lote.datos IS DISTINCT FROM p_grupos THEN
      RAISE EXCEPTION 'Solicitud reutilizada con otros datos' USING ERRCODE='P2103'; END IF;
    RETURN jsonb_build_object('loteId',lote.id,'cantidad',lote.cantidad,'repetida',true);
  END IF;
  -- La inserción es parte de la misma transacción y se cancela ante cualquier fila inválida.
  INSERT INTO public.entregas_lotes(id,actor,datos,cantidad) VALUES(p_solicitud,p_actor,p_grupos,1);
  FOR grupo IN SELECT value FROM jsonb_array_elements(p_grupos) LOOP
    IF jsonb_typeof(grupo) IS DISTINCT FROM 'object' OR jsonb_typeof(grupo->'equipos') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Grupo inválido' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(grupo->'equipos') NOT BETWEEN 1 AND 2500 THEN
      RAISE EXCEPTION 'Grupo vacío' USING ERRCODE='22023'; END IF;
    SELECT * INTO sede FROM public.sedes WHERE id=(grupo->>'sedeId')::uuid AND activo AND tipo='jardin_infantil' FOR SHARE;
    IF NOT FOUND OR sede.id=ANY(sedes_vistas) THEN
      RAISE EXCEPTION 'Se requiere un jardín activo, sin repetir grupos' USING ERRCODE='P2101'; END IF;
    sedes_vistas:=array_append(sedes_vistas,sede.id);
    nombre:=btrim(grupo->>'receptora');
    IF nombre IS NULL OR length(nombre) NOT BETWEEN 1 AND 200 OR nombre ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Identificar a la directora receptora' USING ERRCODE='22023'; END IF;
    IF COALESCE(grupo->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Fecha requerida' USING ERRCODE='22023'; END IF;
    fecha:=(grupo->>'fecha')::date;
    IF fecha<(DATE '1900-01-01') OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN
      RAISE EXCEPTION 'Fecha de entrega inválida' USING ERRCODE='22023'; END IF;
    enlace:=NULLIF(btrim(grupo->>'enlaceActa'),'');
    IF enlace IS NOT NULL AND (length(enlace)>1500 OR enlace !~ '^https?://[^[:space:]]+$') THEN
      RAISE EXCEPTION 'Enlace inválido' USING ERRCODE='22023'; END IF;
    INSERT INTO public.entregas_equipos(lote_id,sede_id,sede_nombre,sede_rbd,comuna,fecha_entrega,receptor_nombre,receptor_cargo,enlace_acta)
    VALUES(p_solicitud,sede.id,sede.nombre,sede.rbd,sede.comuna,fecha,nombre,'Directora del jardín infantil',enlace) RETURNING id INTO entrega;
    FOR item IN SELECT value FROM jsonb_array_elements(grupo->'equipos') LOOP
      equipo_uuid:=(item->>'id')::uuid;
      IF equipo_uuid IS NULL OR equipo_uuid=ANY(vistos) OR cantidad>=2500 THEN
        RAISE EXCEPTION 'Selección duplicada o inválida' USING ERRCODE='22023'; END IF;
      vistos:=array_append(vistos,equipo_uuid);
      SELECT * INTO anterior FROM public.equipos WHERE id=equipo_uuid FOR UPDATE;
      IF NOT FOUND OR anterior.sede_id<>sede.id OR anterior.situacion<>'pendiente_entrega'
        OR anterior.version IS DISTINCT FROM (item->>'version')::integer THEN
        RAISE EXCEPTION 'La selección cambió; revisar nuevamente' USING ERRCODE='P2102'; END IF;
      UPDATE public.equipos SET situacion='recibido',fecha_entrega=fecha,enlace_acta=COALESCE(enlace,enlace_acta),
        version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=anterior.id RETURNING * INTO posterior;
      INSERT INTO public.entregas_detalle(entrega_id,equipo_id,antes,despues) VALUES(entrega,anterior.id,to_jsonb(anterior),to_jsonb(posterior));
      INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,entrega_id)
      VALUES(anterior.id,p_actor,'Regularización de entrega a directora: '||nombre||'. Acta existente sin folio informado.',to_jsonb(anterior),to_jsonb(posterior),entrega);
      cantidad:=cantidad+1;
    END LOOP;
    grupos:=grupos+1;
  END LOOP;
  UPDATE public.entregas_lotes SET cantidad=cardinality(vistos) WHERE id=p_solicitud;
  RETURN jsonb_build_object('loteId',p_solicitud,'cantidad',cantidad,'grupos',grupos,'repetida',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.regularizar_entregas_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regularizar_entregas_acceso(text,uuid,jsonb) TO inventario_app;
  `);
}
export const down = false;
