export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.incidentes_robos (
 id uuid PRIMARY KEY,
 sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
 sede_nombre text NOT NULL, sede_rbd text, sede_tipo text NOT NULL, comuna text,
 fecha date NOT NULL, lugar text NOT NULL, descripcion text NOT NULL, enlace text,
 estado text NOT NULL DEFAULT 'reportado' CHECK(estado IN ('reportado','validado','rechazado')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 reportado_por text NOT NULL, registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 solicitud jsonb NOT NULL
);
CREATE TABLE public.incidentes_robos_equipos (
 incidente_id uuid NOT NULL REFERENCES public.incidentes_robos(id) ON DELETE RESTRICT,
 equipo_id uuid NOT NULL REFERENCES public.equipos(id) ON DELETE RESTRICT,
 identificacion jsonb NOT NULL,
 recuperado_fecha date, recuperado_por text, recuperacion_motivo text,
 PRIMARY KEY(incidente_id,equipo_id)
);
CREATE TABLE public.incidentes_robos_historial (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 incidente_id uuid NOT NULL REFERENCES public.incidentes_robos(id) ON DELETE RESTRICT,
 equipo_id uuid REFERENCES public.equipos(id) ON DELETE RESTRICT,
 evento text NOT NULL CHECK(evento IN ('reportado','validado','rechazado','recuperado')),
 actor text NOT NULL, motivo text NOT NULL, datos jsonb NOT NULL,
 registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX incidentes_robos_sede_fecha_idx ON public.incidentes_robos(sede_id,fecha);
CREATE INDEX incidentes_robos_equipo_idx ON public.incidentes_robos_equipos(equipo_id);
ALTER TABLE public.equipos_historial ADD COLUMN incidente_id uuid REFERENCES public.incidentes_robos(id) ON DELETE RESTRICT;
REVOKE ALL ON public.incidentes_robos,public.incidentes_robos_equipos,public.incidentes_robos_historial FROM PUBLIC,inventario_app;
GRANT SELECT ON public.incidentes_robos,public.incidentes_robos_equipos,public.incidentes_robos_historial TO inventario_app;

CREATE FUNCTION public.reportar_robo_acceso(p_actor text,p_id uuid,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE usuario public.usuarios_acceso%ROWTYPE; sede public.sedes%ROWTYPE;
 equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE; anterior public.incidentes_robos%ROWTYPE;
 fecha date; lugar text; descripcion text; enlace text; fila jsonb; vistos uuid[]:=ARRAY[]::uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 SELECT * INTO usuario FROM public.usuarios_acceso WHERE correo=p_actor AND activo
   AND rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text)>1000000
   OR jsonb_typeof(p_datos->'equipos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_datos->'equipos') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Seleccionar entre 1 y 200 equipos' USING ERRCODE='22023'; END IF;
 SELECT * INTO anterior FROM public.incidentes_robos WHERE id=p_id;
 IF FOUND THEN
  IF anterior.reportado_por<>p_actor OR anterior.solicitud IS DISTINCT FROM p_datos THEN RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P2303'; END IF;
  RETURN jsonb_build_object('id',p_id,'repetida',true);
 END IF;
 SELECT * INTO sede FROM public.sedes WHERE id=(p_datos->>'sedeId')::uuid AND activo FOR SHARE;
 IF NOT FOUND OR (usuario.rol='encargado' AND usuario.sede_id IS DISTINCT FROM sede.id) THEN RAISE EXCEPTION 'Sede no autorizada' USING ERRCODE='42501'; END IF;
 IF COALESCE(p_datos->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Fecha requerida' USING ERRCODE='22023'; END IF;
 fecha:=(p_datos->>'fecha')::date;
 lugar:=btrim(p_datos->>'lugar'); descripcion:=btrim(p_datos->>'descripcion'); enlace:=NULLIF(btrim(p_datos->>'enlace'),'');
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
  OR lugar IS NULL OR length(lugar) NOT BETWEEN 1 AND 300 OR lugar ~ '[[:cntrl:]]'
  OR descripcion IS NULL OR length(descripcion) NOT BETWEEN 1 AND 3000
  OR (enlace IS NOT NULL AND (length(enlace)>1500 OR enlace !~* '^https?://[^[:space:]]+$' OR enlace ~* '^https?://[^/]*@')) THEN RAISE EXCEPTION 'Antecedentes inválidos' USING ERRCODE='22023'; END IF;
 INSERT INTO public.incidentes_robos(id,sede_id,sede_nombre,sede_rbd,sede_tipo,comuna,fecha,lugar,descripcion,enlace,reportado_por,solicitud)
 VALUES(p_id,sede.id,sede.nombre,sede.rbd,sede.tipo,sede.comuna,fecha,lugar,descripcion,enlace,p_actor,p_datos);
 FOR fila IN SELECT value FROM jsonb_array_elements(p_datos->'equipos') LOOP
  SELECT * INTO equipo FROM public.equipos WHERE id=(fila->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR equipo.id=ANY(vistos) OR equipo.sede_id<>sede.id OR equipo.version IS DISTINCT FROM (fila->>'version')::integer THEN
   RAISE EXCEPTION 'La selección cambió; revisar nuevamente' USING ERRCODE='P2301'; END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id
    WHERE d.equipo_id=equipo.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN
   RAISE EXCEPTION 'Equipo con incidente abierto' USING ERRCODE='P2302'; END IF;
  vistos:=array_append(vistos,equipo.id);
  INSERT INTO public.incidentes_robos_equipos(incidente_id,equipo_id,identificacion)
  SELECT p_id,equipo.id,jsonb_build_object('marca',equipo.marca,'modelo',equipo.modelo,'serie',equipo.serie,
    'inventario',equipo.numero_inventario,'categoriaId',equipo.categoria_id,'categoria',c.nombre) FROM public.categorias_bienes c WHERE c.id=equipo.categoria_id;
  UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=equipo.id RETURNING * INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
  VALUES(equipo.id,p_actor,'Robo reportado, pendiente de validación.',to_jsonb(equipo),to_jsonb(posterior),p_id);
 END LOOP;
 INSERT INTO public.incidentes_robos_historial(incidente_id,evento,actor,motivo,datos)
 VALUES(p_id,'reportado',p_actor,descripcion,jsonb_build_object('equipos',vistos,'fecha',fecha,'lugar',lugar));
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;
$fn$;

CREATE FUNCTION public.resolver_robo_acceso(p_actor text,p_id uuid,p_version integer,p_decision text,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE incidente public.incidentes_robos%ROWTYPE; equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT * INTO incidente FROM public.incidentes_robos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR incidente.estado<>'reportado' OR incidente.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'El incidente cambió' USING ERRCODE='P2301'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('validado','rechazado') OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023'; END IF;
 UPDATE public.incidentes_robos SET estado=p_decision,version=version+1 WHERE id=p_id;
 INSERT INTO public.incidentes_robos_historial(incidente_id,evento,actor,motivo,datos)
 VALUES(p_id,p_decision,p_actor,btrim(p_motivo),jsonb_build_object('antes',incidente.estado,'despues',p_decision));
 FOR equipo IN SELECT e.* FROM public.equipos e JOIN public.incidentes_robos_equipos d ON d.equipo_id=e.id WHERE d.incidente_id=p_id ORDER BY e.id FOR UPDATE OF e LOOP
  UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=equipo.id RETURNING * INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
  VALUES(equipo.id,p_actor,'Incidente de robo '||p_decision||': '||btrim(p_motivo),to_jsonb(equipo),to_jsonb(posterior),p_id);
 END LOOP;
 RETURN p_version+1;
END;
$fn$;

CREATE FUNCTION public.recuperar_equipo_robo_acceso(p_actor text,p_id uuid,p_version integer,p_equipo uuid,p_fecha date,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE incidente public.incidentes_robos%ROWTYPE; detalle public.incidentes_robos_equipos%ROWTYPE;
 equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT * INTO incidente FROM public.incidentes_robos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR incidente.estado<>'validado' OR incidente.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'El incidente cambió' USING ERRCODE='P2301'; END IF;
 SELECT * INTO detalle FROM public.incidentes_robos_equipos WHERE incidente_id=p_id AND equipo_id=p_equipo FOR UPDATE;
 IF NOT FOUND OR detalle.recuperado_fecha IS NOT NULL THEN RAISE EXCEPTION 'Equipo no recuperable en este incidente' USING ERRCODE='P2301'; END IF;
 IF p_fecha IS NULL OR p_fecha<incidente.fecha OR p_fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
   OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Recuperación inválida' USING ERRCODE='22023'; END IF;
 UPDATE public.incidentes_robos_equipos SET recuperado_fecha=p_fecha,recuperado_por=p_actor,recuperacion_motivo=btrim(p_motivo) WHERE incidente_id=p_id AND equipo_id=p_equipo;
 UPDATE public.incidentes_robos SET version=version+1 WHERE id=p_id;
 INSERT INTO public.incidentes_robos_historial(incidente_id,equipo_id,evento,actor,motivo,datos)
 VALUES(p_id,p_equipo,'recuperado',p_actor,btrim(p_motivo),jsonb_build_object('fecha',p_fecha,'equipoId',p_equipo));
 SELECT * INTO equipo FROM public.equipos WHERE id=p_equipo FOR UPDATE;
 UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_equipo RETURNING * INTO posterior;
 INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
 VALUES(p_equipo,p_actor,'Equipo recuperado el '||p_fecha||': '||btrim(p_motivo),to_jsonb(equipo),to_jsonb(posterior),p_id);
 RETURN p_version+1;
END;
$fn$;
-- Un equipo reportado/robado no puede regularizarse simultáneamente como entregado.
CREATE FUNCTION public.impedir_entrega_equipo_incidente() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF OLD.situacion='pendiente_entrega' AND NEW.situacion<>'pendiente_entrega' AND EXISTS(
  SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id
  WHERE d.equipo_id=OLD.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL
 ) THEN RAISE EXCEPTION 'Equipo con incidente abierto' USING ERRCODE='P2302'; END IF;
 RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.impedir_entrega_equipo_incidente() FROM PUBLIC;
CREATE TRIGGER equipo_entrega_incidente BEFORE UPDATE OF situacion ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.impedir_entrega_equipo_incidente();
REVOKE ALL ON FUNCTION public.reportar_robo_acceso(text,uuid,jsonb),public.resolver_robo_acceso(text,uuid,integer,text,text),public.recuperar_equipo_robo_acceso(text,uuid,integer,uuid,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reportar_robo_acceso(text,uuid,jsonb),public.resolver_robo_acceso(text,uuid,integer,text,text),public.recuperar_equipo_robo_acceso(text,uuid,integer,uuid,date,text) TO inventario_app;
 `);
}
export const down=false;
